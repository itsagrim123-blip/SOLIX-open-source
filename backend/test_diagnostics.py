import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.workspace.diagnostics import diagnostic_parser

def test_gcc_diagnostics():
    raw = """
main.cpp:5:10: error: 'missing' was not declared in this scope
    5 |     std::cout << missing;
      |                  ^~~~~~~
main.cpp:7:1: warning: control reaches end of non-void function [-Wreturn-type]
    """
    diags = diagnostic_parser.parse(raw)
    assert len(diags) == 2
    assert diags[0].file == "main.cpp"
    assert diags[0].line == 5
    assert diags[0].column == 10
    assert diags[0].severity == "error"
    assert "missing" in diags[0].message

    assert diags[1].file == "main.cpp"
    assert diags[1].line == 7
    assert diags[1].column == 1
    assert diags[1].severity == "warning"

def test_python_traceback():
    raw = """
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(10 / 0)
ZeroDivisionError: division by zero
    """
    diags = diagnostic_parser.parse(raw)
    assert len(diags) == 1
    assert diags[0].file == "main.py"
    assert diags[0].line == 4
    assert diags[0].severity == "error"
    assert "ZeroDivisionError: division by zero" in diags[0].message

def test_typescript_diagnostics():
    raw = "src/index.ts(14,5): error TS2304: Cannot find name 'foo'."
    diags = diagnostic_parser.parse(raw)
    assert len(diags) == 1
    assert diags[0].file == "src/index.ts"
    assert diags[0].line == 14
    assert diags[0].column == 5
    assert diags[0].severity == "error"
    assert "TS2304" in diags[0].message

if __name__ == "__main__":
    test_gcc_diagnostics()
    test_python_traceback()
    test_typescript_diagnostics()
    print("ALL DIAGNOSTICS TESTS PASSED!")

