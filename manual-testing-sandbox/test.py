class Calculator:
    def __init__(self):
        """Initialize the calculator with a result of zero."""
        self.result = 0

    def add(self, number):
        """Add a number to the result."""
        self.result += number
        return self

    def subtract(self, number):
        """Subtract a number from the result."""
        self.result -= number
        return self

    def reset(self):
        """Reset the result to zero."""
        self.result = 0
        return self

    def get_result(self):
        """Return the current result."""
        return self.result