import json
import argparse

class BC3Parser:
    """Parses a .bc3 file and extracts records."""

    def parse(self, file_path, skip_measurements=False):
        """
        Parses a .bc3 file.

        Args:
            file_path (str): The path to the .bc3 file.
            skip_measurements (bool): If True, skips parsing of ~M records for faster processing.

        Returns:
            list: A list of parsed records.
        """
        try:
            with open(file_path, 'r', encoding='iso-8859-1', errors='ignore') as f:
                content = f.read()
        except FileNotFoundError:
            print(f"Error: File not found at {file_path}")
            return []
        except Exception as e:
            print(f"Error reading file: {e}")
            return []

        records = []
        # Clean the content by removing the EOF character if it exists
        if content.endswith('\x1a'):
            content = content[:-1]

        raw_records = content.split('~')
        for raw_record in raw_records:
            if not raw_record.strip():
                continue

            record_type = raw_record[0]
            
            # Skip measurement records if requested
            if skip_measurements and record_type == 'M':
                continue
                
            data = raw_record[1:].strip()
            
            # Remove leading pipe if it exists (common in BC3 format)
            if data.startswith('|'):
                data = data[1:]
            
            # Dynamically call the appropriate parse method (e.g., _parse_V, _parse_C)
            parse_method = getattr(self, f"_parse_{record_type}", self._parse_unknown)
            parsed_data = parse_method(data)
            # Add the raw record type for reference, especially for unknown types
            parsed_data['record_type'] = record_type 
            records.append(parsed_data)
            
        return records

    def _split_fields(self, data):
        """Splits a record's data into fields."""
        return [field.strip() for field in data.split('|')]

    def _split_subfields(self, field):
        """Splits a field into subfields."""
        return [subfield.strip() for subfield in field.split('\\')]
    
    def _parse_unknown(self, data):
        """Handles any unknown record types."""
        return {"data": data}

    def _parse_V(self, data):
        """Parses a ~V record (Ownership and Version)."""
        fields = self._split_fields(data)
        format_version_subfields = self._split_subfields(fields[1]) if len(fields) > 1 else ['']
        header_subfields = self._split_subfields(fields[4]) if len(fields) > 4 else ['']
        return {
            "file_ownership": fields[0] if len(fields) > 0 else '',
            "format_version": format_version_subfields[0],
            "date": format_version_subfields[1] if len(format_version_subfields) > 1 else '',
            "emission_program": fields[2] if len(fields) > 2 else '',
            "header": header_subfields[0],
            "identification_labels": header_subfields[1:],
            "character_set": fields[5] if len(fields) > 5 else '',
            "comment": fields[6] if len(fields) > 6 else '',
            "information_type": fields[7] if len(fields) > 7 else '',
            "certification_number": fields[8] if len(fields) > 8 else '',
            "certification_date": fields[9] if len(fields) > 9 else '',
            "url_base": fields[10] if len(fields) > 10 else '',
        }

    def _parse_K(self, data):
        """Parses a ~K record (Coefficients)."""
        fields = self._split_fields(data)
        subfields1 = self._split_subfields(fields[0]) if len(fields) > 0 else []
        subfields2 = self._split_subfields(fields[1]) if len(fields) > 1 else []
        return {
            "decimals": {
                "DN": subfields1[0] if len(subfields1) > 0 else '', "DD": subfields1[1] if len(subfields1) > 1 else '',
                "DS": subfields1[2] if len(subfields1) > 2 else '', "DR": subfields1[3] if len(subfields1) > 3 else '',
                "DI": subfields1[4] if len(subfields1) > 4 else '', "DP": subfields1[5] if len(subfields1) > 5 else '',
                "DC": subfields1[6] if len(subfields1) > 6 else '', "DM": subfields1[7] if len(subfields1) > 7 else '',
                "CURRENCY": subfields1[8] if len(subfields1) > 8 else '',
            },
            "percentages": {
                "CI": subfields2[0] if len(subfields2) > 0 else '', "GG": subfields2[1] if len(subfields2) > 1 else '',
                "BI": subfields2[2] if len(subfields2) > 2 else '', "REDUCTION": subfields2[3] if len(subfields2) > 3 else '',
                "VAT": subfields2[4] if len(subfields2) > 4 else '',
            }
        }

    def _parse_C(self, data):
        """Parses a ~C record (Concept)."""
        fields = self._split_fields(data)
        return {
            "code": fields[0] if len(fields) > 0 else '',
            "unit": fields[1] if len(fields) > 1 else '',
            "summary": fields[2] if len(fields) > 2 else '',
            "price": self._split_subfields(fields[3]) if len(fields) > 3 else [],
            "date": self._split_subfields(fields[4]) if len(fields) > 4 else [],
            "type": fields[5] if len(fields) > 5 else '',
        }

    def _parse_D(self, data):
        """Parses a ~D record (Decomposition)."""
        fields = self._split_fields(data)
        children = []
        
        if len(fields) > 1:
            # According to FIEBDC-3 specification, children can be in separate fields OR packed in one field
            # Handle both formats:
            # Format 1 (spec): ~D | PARENT_CODE | CHILD_CODE\FACTOR\OUTPUT | CHILD_CODE\FACTOR\OUTPUT | ...
            # Format 2 (common): ~D | PARENT_CODE | CHILD_CODE\FACTOR\OUTPUT\CHILD_CODE\FACTOR\OUTPUT\... |
            
            for field in fields[1:]:  # Skip the parent code field
                if not field.strip():
                    continue
                
                # Check if this field contains multiple children (backslash-separated)
                if '\\' in field and field.count('\\') > 2:
                    # Format 2: Multiple children packed in one field
                    # Split by backslash to get all parts
                    parts = field.split('\\')
                    
                    # Group parts into triplets (code, factor, output)
                    i = 0
                    while i < len(parts):
                        if parts[i].strip():  # If we have a child code
                            child_code = parts[i]
                            factor = parts[i + 1] if i + 1 < len(parts) else '1'
                            output = parts[i + 2] if i + 2 < len(parts) else '1'
                            
                            children.append({
                                "child_code": child_code,
                                "factor": factor if factor else '1',
                                "output": output if output else '1',
                            })
                            i += 3  # Move to next triplet
                        else:
                            i += 1  # Skip empty parts
                else:
                    # Format 1: Single child per field (following FIEBDC-3 spec exactly)
                    # Each field is: CHILD_CODE\FACTOR\OUTPUT
                    parts = field.split('\\')
                    if parts[0].strip():  # If we have a child code
                        children.append({
                            "child_code": parts[0],
                            "factor": parts[1] if len(parts) > 1 and parts[1] else '1',
                            "output": parts[2] if len(parts) > 2 and parts[2] else '1',
                        })
                        
        return {
            "parent_code": fields[0] if len(fields) > 0 else '',
            "children": children
        }

    def _parse_M(self, data):
        """Parses a ~M record (Measurement)."""
        fields = self._split_fields(data)
        parent_child = self._split_subfields(fields[0]) if len(fields) > 0 else ['', '']
        
        # Parse measurement details if available
        measurement_details = []
        if len(fields) > 3:
            details_field = fields[3]
            if details_field:
                detail_parts = self._split_subfields(details_field)
                # According to BC3 spec: TYPE\COMMENT{#ID_BIM}\UNITS\LENGTH\LATITUDE\HEIGHT\
                if len(detail_parts) >= 4:
                    measurement_details.append({
                        'type': detail_parts[0] if detail_parts[0] else '',
                        'comment': detail_parts[1] if len(detail_parts) > 1 else '',
                        'units': detail_parts[2] if len(detail_parts) > 2 else '',
                        'length': detail_parts[3] if len(detail_parts) > 3 else '',
                        'latitude': detail_parts[4] if len(detail_parts) > 4 else '',
                        'height': detail_parts[5] if len(detail_parts) > 5 else '',
                    })
        
        return {
            "parent_code": parent_child[0] if len(parent_child) > 0 else '',
            "child_code": parent_child[1] if len(parent_child) > 1 else parent_child[0], # child_code is mandatory
            "position": fields[1] if len(fields) > 1 else '',
            "total_measurement": fields[2] if len(fields) > 2 else '',
            "measurement_details": measurement_details,
            "label": fields[4] if len(fields) > 4 else '',
        }

    def _parse_T(self, data):
        """Parses a ~T record (Text)."""
        fields = self._split_fields(data)
        return {
            "concept_code": fields[0] if len(fields) > 0 else '',
            "descriptive_text": fields[1] if len(fields) > 1 else '',
        }

class BC3Composer:
    """Composes a tree structure from parsed BC3 records."""

    def compose_tree(self, records, skip_measurements=False):
        """
        Builds a hierarchical tree from a flat list of records.

        Args:
            records (list): A list of parsed BC3 records.
            skip_measurements (bool): If True, skips processing of ~M records during tree composition.

        Returns:
            dict: A dictionary representing the root of the tree or other top-level info.
        """
        # Store concepts and other records in separate dictionaries for easier access
        concepts = {r['code']: r for r in records if r.get('record_type') == 'C'}
        other_records = [r for r in records if r.get('record_type') != 'C']
        
        # Link related data (like texts, decompositions, and measurements) to concepts
        decomposition_count = 0
        linked_decompositions = 0
        measurement_count = 0
        linked_measurements = 0
        
        for record in other_records:
            record_type = record.get('record_type')
            if record_type == 'T':
                if record['concept_code'] in concepts:
                    concepts[record['concept_code']]['descriptive_text'] = record['descriptive_text']
            elif record_type == 'M' and not skip_measurements:
                measurement_count += 1
                parent_code = record['parent_code']
                child_code = record['child_code']
                
                # Link measurement to the child concept (the one being measured)
                if child_code in concepts:
                    linked_measurements += 1
                    if 'measurements' not in concepts[child_code]:
                        concepts[child_code]['measurements'] = []
                    concepts[child_code]['measurements'].append({
                        'parent_code': parent_code,
                        'position': record.get('position', ''),
                        'total_measurement': record['total_measurement'],
                        'measurement_details': record.get('measurement_details', []),
                        'label': record.get('label', '')
                    })
                else:
                    # Try to find similar child code variations
                    variations = [child_code, child_code + '#', child_code + '##', child_code.replace('\\0', '')]
                    found_child = None
                    for variation in variations:
                        if variation in concepts:
                            found_child = variation
                            break
                    
                    if found_child:
                        linked_measurements += 1
                        if 'measurements' not in concepts[found_child]:
                            concepts[found_child]['measurements'] = []
                        concepts[found_child]['measurements'].append({
                            'parent_code': parent_code,
                            'position': record.get('position', ''),
                            'total_measurement': record['total_measurement'],
                            'measurement_details': record.get('measurement_details', []),
                            'label': record.get('label', '')
                        })
            elif record_type == 'D':
                decomposition_count += 1
                parent_code = record['parent_code']
                
                if parent_code in concepts:
                    linked_decompositions += 1
                    if 'children' not in concepts[parent_code]:
                        concepts[parent_code]['children'] = []
                    # Attach the actual child concept object
                    for child_info in record.get('children', []):
                        child_code = child_info['child_code']
                        
                        # Try multiple variations of the child code
                        variations = [child_code, child_code + '#', child_code + '##']
                        found_child = None
                        for variation in variations:
                            if variation in concepts:
                                found_child = variation
                                break
                        
                        if found_child:
                            child_concept = concepts[found_child].copy()
                            child_concept['factor'] = child_info.get('factor', '1')
                            child_concept['output'] = child_info.get('output', '1')
                            concepts[parent_code]['children'].append(child_concept)
                else:
                    # Try to find a similar parent code (maybe without \0)
                    found_parent = False
                    for concept_code in concepts:
                        if concept_code.replace('\\0', '') == parent_code:
                            found_parent = True
                            linked_decompositions += 1
                            if 'children' not in concepts[concept_code]:
                                concepts[concept_code]['children'] = []
                            for child_info in record.get('children', []):
                                child_code = child_info['child_code']
                                
                                # Try multiple variations of the child code
                                variations = [child_code, child_code + '#', child_code + '##']
                                found_child = None
                                for variation in variations:
                                    if variation in concepts:
                                        found_child = variation
                                        break
                                
                                if found_child:
                                    child_concept = concepts[found_child].copy()
                                    child_concept['factor'] = child_info.get('factor', '1')
                                    child_concept['output'] = child_info.get('output', '1')
                                    concepts[concept_code]['children'].append(child_concept)
                            break
                    
        print(f"Processed {decomposition_count} decomposition records, linked {linked_decompositions} successfully")
        if not skip_measurements:
            print(f"Processed {measurement_count} measurement records, linked {linked_measurements} successfully")
        else:
            print("Measurement records skipped (skip_measurements=True)")

        # Helper function to classify concept type based on code patterns
        def classify_concept(parent_code, concept_code):
            """
            Classifies a concept based on its code and parent's code:
            - SUBCAPITULO: parent ends with # and child ends with #
            - PARTIDA: parent ends with # but child doesn't end with #
            - DESCOMPUESTO: neither parent nor child ends with #
            """
            if parent_code is None:
                # Root concept (contains ##)
                if '##' in concept_code:
                    return 'ROOT'
                return 'UNKNOWN'
            
            parent_ends_with_hash = parent_code.rstrip('\\0').endswith('#')
            concept_ends_with_hash = concept_code.rstrip('\\0').endswith('#')
            
            if parent_ends_with_hash and concept_ends_with_hash:
                return 'SUBCAPITULO'
            elif parent_ends_with_hash and not concept_ends_with_hash:
                return 'PARTIDA'
            elif not parent_ends_with_hash and not concept_ends_with_hash:
                return 'DESCOMPUESTO'
            else:
                return 'UNKNOWN'

        # Build the hierarchical tree recursively
        def build_tree(concept_code, parent_code=None, path=None, depth=0):
            if path is None:
                path = []
            
            # Prevent infinite recursion (circular references and reasonable depth)
            if depth > 50:  # Increased depth limit for deep construction budgets
                print(f"Warning: Depth limit reached for {concept_code} at depth {depth}")
                return None
                
            if concept_code in path:  # Circular reference
                print(f"Warning: Circular reference detected for {concept_code}")
                return None
            
            if concept_code not in concepts:
                return None
            
            concept = concepts[concept_code].copy()
            
            # Add concept classification
            concept['concept_type'] = classify_concept(parent_code, concept_code)
            
            # If this concept has children, build their trees recursively
            if 'children' in concept and len(concept['children']) > 0:
                built_children = []
                new_path = path + [concept_code]
                for child in concept['children']:
                    child_tree = build_tree(child['code'], concept_code, new_path, depth + 1)
                    if child_tree:
                        # Preserve factor and output from decomposition
                        child_tree['factor'] = child.get('factor', '1')
                        child_tree['output'] = child.get('output', '1')
                        built_children.append(child_tree)
                concept['children'] = built_children
            else:
                # Remove empty children array for leaf nodes
                if 'children' in concept:
                    del concept['children']
            
            return concept

        # Find the root concept (code contains '##')
        root_concept = None
        root_code = None
        
        for code, concept in concepts.items():
            if '##' in code:
                root_code = code
                break
        
        # Build the complete tree starting from the root
        if root_code:
            root_concept = build_tree(root_code, None)
        
        # Assemble the final output
        final_output = {
            "header": next((r for r in records if r.get('record_type') == 'V'), None),
            "coefficients": next((r for r in records if r.get('record_type') == 'K'), None),
            "budget": root_concept
        }
        
        return final_output


def main():
    """Main function to parse command-line arguments and run the conversion."""
    cli_parser = argparse.ArgumentParser(
        description="Parse a .bc3 file and convert it to a structured JSON tree.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    cli_parser.add_argument("input_file", help="The path to the input .bc3 file.")
    cli_parser.add_argument(
        "-o", "--output",
        help="The path for the output .json file.\nIf not provided, the output is printed to the console."
    )
    cli_parser.add_argument(
        "--skip-measurements", 
        action="store_true",
        help="Skip parsing and processing of measurement records (~M) for faster conversion and smaller output."
    )
    
    args = cli_parser.parse_args()

    parser = BC3Parser()
    composer = BC3Composer()

    # 1. Parse the .bc3 file from the command-line argument
    print(f"Parsing {args.input_file}...")
    if args.skip_measurements:
        print("  Skipping measurement records for faster processing...")
    parsed_records = parser.parse(args.input_file, skip_measurements=args.skip_measurements)

    if not parsed_records:
        print(f"No records were parsed from {args.input_file}. Exiting.")
        return

    # 2. Compose the tree structure
    print("Composing JSON tree...")
    json_tree = composer.compose_tree(parsed_records, skip_measurements=args.skip_measurements)

    # 3. Serialize the composed tree to a JSON string
    json_output = json.dumps(json_tree, indent=2, ensure_ascii=False)

    # 4. Write to output file or print to console
    if args.output:
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(json_output)
            print(f"Successfully converted and saved to {args.output}")
        except Exception as e:
            print(f"Error writing to output file {args.output}: {e}")
    else:
        print("\n--- Composed JSON Tree ---")
        print(json_output)


if __name__ == '__main__':    
    main()