import json
import argparse
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional

class BC3PrettyCalculator:
    """Pretty calculator for BC3 budgets with tree visualization."""
    
    def __init__(self):
        self.concepts = {}  # Store all concepts by code
        self.unit_prices = {}  # Store calculated unit prices
        self.tree_chars = {
            'branch': '├── ',
            'last_branch': '└── ',
            'vertical': '│   ',
            'space': '    '
        }
    
    def load_budget(self, json_file: str) -> Dict[str, Any]:
        """Load budget from JSON file."""
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
        except FileNotFoundError:
            print(f"❌ Error: File not found at {json_file}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Error: Invalid JSON format in {json_file}: {e}")
            return None
        except Exception as e:
            print(f"❌ Error reading file: {e}")
            return None
    
    def index_concepts(self, node: Dict[str, Any]):
        """Recursively index all concepts for quick lookup."""
        if not node or not isinstance(node, dict):
            return
            
        code = node.get('code', '')
        if code:
            self.concepts[code] = node
            
        # Process children
        for child in node.get('children', []):
            self.index_concepts(child)
    
    def calculate_unit_price(self, concept_code: str) -> Decimal:
        """Calculate unit price for a concept following BC3 rules."""
        if concept_code in self.unit_prices:
            return self.unit_prices[concept_code]
        
        if concept_code not in self.concepts:
            self.unit_prices[concept_code] = Decimal('0')
            return Decimal('0')
        
        concept = self.concepts[concept_code]
        concept_type = concept.get('concept_type', 'UNKNOWN')
        
        # Get base price from concept
        try:
            price_list = concept.get('price', ['0'])
            base_price = Decimal(str(price_list[0])) if price_list else Decimal('0')
        except (ValueError, IndexError):
            base_price = Decimal('0')
        
        unit_price = Decimal('0')
        
        if concept_type == 'DESCOMPUESTO':
            # DESCOMPUESTO: Use unit price directly
            unit_price = base_price
        
        elif concept_type in ['PARTIDA', 'SUBCAPITULO', 'ROOT']:
            # PARTIDA/SUBCAPITULO/ROOT: Sum of children with factors and outputs
            children = concept.get('children', [])
            if children:
                total = Decimal('0')
                for child in children:
                    child_code = child.get('code', '')
                    child_unit_price = self.calculate_unit_price(child_code)
                    
                    try:
                        factor = Decimal(str(child.get('factor', '1')))
                        output = Decimal(str(child.get('output', '1')))
                    except ValueError:
                        factor = Decimal('1')
                        output = Decimal('1')
                    
                    child_amount = factor * output * child_unit_price
                    total += child_amount
                
                unit_price = total
            else:
                # No children, use base price
                unit_price = base_price
        
        else:
            # Unknown type, use base price
            unit_price = base_price
        
        # Round to 4 decimal places
        unit_price = unit_price.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        self.unit_prices[concept_code] = unit_price
        return unit_price
    
    def format_price(self, price: Decimal) -> str:
        """Format price with thousands separators."""
        if price == 0:
            return "0.00"
        
        # Format with 2 decimal places and thousands separators
        formatted = f"{price:,.2f}"
        return formatted
    
    def get_concept_level(self, code: str) -> int:
        """Determine the hierarchical level of a concept based on its code."""
        if '##' in code:
            return 0  # ROOT
        elif code.endswith('#'):
            # Count dots to determine subcapitulo level
            dots = code.count('.')
            return dots + 1
        else:
            # PARTIDA or DESCOMPUESTO - count dots + 2
            dots = code.count('.')
            return dots + 2
    
    def should_show_concept(self, code: str, max_level: int) -> bool:
        """Determine if concept should be shown based on max_level filter."""
        if max_level is None:
            return True
        return self.get_concept_level(code) <= max_level
    
    def print_tree_node(self, node: Dict[str, Any], prefix: str = "", is_last: bool = True, 
                       max_level: int = None, current_level: int = 0):
        """Print a node in tree format with beautiful formatting."""
        
        code = node.get('code', '')
        if not code:
            return
        
        # Skip if beyond max level
        if max_level is not None and current_level > max_level:
            return
        
        summary = node.get('summary', '')
        unit = node.get('unit', '')
        concept_type = node.get('concept_type', 'UNKNOWN')
        
        # Calculate unit price
        unit_price = self.calculate_unit_price(code)
        
        # Get output quantity
        try:
            output = Decimal(str(node.get('output', '1')))
        except ValueError:
            output = Decimal('1')
        
        # Calculate total amount
        total_amount = unit_price * output
        
        # Choose icon based on concept type
        type_icons = {
            'ROOT': '🏗️ ',
            'SUBCAPITULO': '📂 ',
            'PARTIDA': '📋 ',
            'DESCOMPUESTO': '🔧 '
        }
        icon = type_icons.get(concept_type, '❓ ')
        
        # Format the line
        connector = self.tree_chars['last_branch'] if is_last else self.tree_chars['branch']
        
        # Build the display line
        line_parts = []
        line_parts.append(f"{prefix}{connector}{icon}")
        line_parts.append(f"[{code}]")
        if summary:
            line_parts.append(f" {summary}")
        if unit:
            line_parts.append(f" ({unit})")
        
        # Add price information
        if unit_price > 0:
            line_parts.append(f" | Price: {self.format_price(unit_price)}")
        if output != 1:
            line_parts.append(f" | Qty: {output}")
        if total_amount > 0 and total_amount != unit_price:
            line_parts.append(f" | Total: {self.format_price(total_amount)}")
        
        print(''.join(line_parts))
        
        # Process children
        children = node.get('children', [])
        if children and (max_level is None or current_level < max_level):
            # Filter children that should be shown
            visible_children = [child for child in children 
                              if self.should_show_concept(child.get('code', ''), max_level)]
            
            for i, child in enumerate(visible_children):
                is_last_child = (i == len(visible_children) - 1)
                
                # Prepare prefix for child
                if is_last:
                    child_prefix = prefix + self.tree_chars['space']
                else:
                    child_prefix = prefix + self.tree_chars['vertical']
                
                self.print_tree_node(child, child_prefix, is_last_child, max_level, current_level + 1)
    
    def find_concept_by_code(self, code: str, node: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Find a concept by its code in the tree."""
        if node is None:
            return self.concepts.get(code)
        
        if node.get('code') == code:
            return node
        
        for child in node.get('children', []):
            result = self.find_concept_by_code(code, child)
            if result:
                return result
        
        return None
    
    def calculate_and_display(self, budget_data: Dict[str, Any], chapter_code: str = None, 
                            max_level: int = None):
        """Calculate and display budget in tree format."""
        
        budget = budget_data.get('budget')
        if not budget:
            print("❌ No budget data found in JSON file")
            return
        
        # Index all concepts for quick lookup
        self.index_concepts(budget)
        
        # Determine what to display
        if chapter_code:
            # Find specific chapter
            chapter = self.find_concept_by_code(chapter_code)
            if not chapter:
                print(f"❌ Chapter '{chapter_code}' not found in budget")
                print(f"\n💡 Available chapters:")
                self._list_chapters(budget)
                return
            
            print(f"\n🎯 Chapter Analysis: {chapter_code}")
            print("=" * 60)
            
            # Calculate prices for the chapter and its children
            self.calculate_unit_price(chapter_code)
            
            # Display tree
            self.print_tree_node(chapter, max_level=max_level)
            
        else:
            # Display entire budget
            print(f"\n🏗️  Complete Budget Analysis")
            print("=" * 60)
            
            # Calculate prices for entire budget
            self.calculate_unit_price(budget.get('code', ''))
            
            # Display tree
            self.print_tree_node(budget, max_level=max_level)
        
        # Summary
        if chapter_code:
            chapter_price = self.unit_prices.get(chapter_code, Decimal('0'))
            try:
                chapter_output = Decimal(str(chapter.get('output', '1')))
            except ValueError:
                chapter_output = Decimal('1')
            chapter_total = chapter_price * chapter_output
            
            print(f"\n📊 Chapter Summary:")
            print(f"   Unit Price: {self.format_price(chapter_price)}")
            print(f"   Quantity: {chapter_output}")
            print(f"   Total Amount: {self.format_price(chapter_total)}")
        else:
            root_code = budget.get('code', '')
            total_budget = self.unit_prices.get(root_code, Decimal('0'))
            print(f"\n💰 Total Budget: {self.format_price(total_budget)}")
    
    def _list_chapters(self, budget: Dict[str, Any]):
        """List available chapters."""
        def find_chapters(node, level=0):
            code = node.get('code', '')
            concept_type = node.get('concept_type', '')
            summary = node.get('summary', '')
            
            if concept_type in ['SUBCAPITULO', 'ROOT'] and level <= 2:
                indent = "  " * level
                print(f"{indent}• {code} - {summary}")
            
            for child in node.get('children', []):
                find_chapters(child, level + 1)
        
        find_chapters(budget)


def main():
    """Main function to parse command-line arguments and run the pretty calculator."""
    parser = argparse.ArgumentParser(
        description="Pretty BC3 budget calculator with tree visualization.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("json_file", help="Path to the JSON budget file (from bc3_converter.py)")
    parser.add_argument("chapter", nargs='?', help="Optional chapter code to analyze (e.g., '01#')")
    parser.add_argument(
        "-l", "--level", 
        type=int, 
        help="Maximum depth level to display:\n"
             "  0: ROOT only\n"
             "  1: ROOT + main chapters\n"
             "  2: + sub-chapters\n"
             "  3: + work items (PARTIDA)\n"
             "  4+: + components (DESCOMPUESTO)"
    )
    
    args = parser.parse_args()
    
    # Create calculator
    calc = BC3PrettyCalculator()
    
    # Load budget data
    budget_data = calc.load_budget(args.json_file)
    if not budget_data:
        return 1
    
    # Display budget tree
    calc.calculate_and_display(budget_data, args.chapter, args.level)
    
    return 0


if __name__ == '__main__':
    exit(main())
