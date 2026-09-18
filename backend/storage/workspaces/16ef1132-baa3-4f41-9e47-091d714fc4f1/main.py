"""Solix Starter Project - Main Entrypoint."""

from utils import fibonacci, format_output


def main():
    print("=" * 45)
    print(" Welcome to Solix Coding Workspace! ")
    print("=" * 45)

    n = 10
    series = [fibonacci(i) for i in range(n)]
    print(format_output("Fibonacci Series (First 10)", series))
    print(f"Sum of series: {sum(series)}")
    print("Ready for your code! Ask Solix to edit, test, or debug.")


if __name__ == "__main__":
    main()
