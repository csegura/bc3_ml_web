class BC3Exception(Exception):
    """Base exception for BC3 application."""
    pass

class FileProcessingError(BC3Exception):
    """Raised when file processing fails."""
    pass

class BC3ConversionError(FileProcessingError):
    """Raised when BC3 file conversion fails."""
    pass

class RegistryError(BC3Exception):
    """Raised when registry operations fail."""
    pass

class MLModelError(BC3Exception):
    """Raised when ML model operations fail."""
    pass

class MLModelNotFoundError(MLModelError):
    """Raised when ML model cannot be found or loaded."""
    pass

class ValidationError(BC3Exception):
    """Raised when input validation fails."""
    pass

class InvalidLocalizationError(ValidationError):
    """Raised when invalid localization is provided."""
    pass

class InvalidEmailError(ValidationError):
    """Raised when invalid email is provided.""" 
    pass

class InvalidYearError(ValidationError):
    """Raised when invalid year is provided."""
    pass

class FileNotFoundError(BC3Exception):
    """Raised when a required file is not found."""
    pass

class RecordNotFoundError(BC3Exception):
    """Raised when a record is not found."""
    pass

class NodeNotFoundError(BC3Exception):
    """Raised when a node is not found in the tree."""
    pass