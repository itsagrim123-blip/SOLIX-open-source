"""Updated utils module."""

def fibonacci(n: int) -> int:
    if n <= 0:
        return 0
    if n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

def format_output(title: str, data: list) -> str:
    items_str = ", ".join(str(x) for x in data)
    return f"[{title}]: [ {items_str} ]"

def cube(x: int) -> int:
    """Calculate the cube of an integer."""
    return x * x * x
