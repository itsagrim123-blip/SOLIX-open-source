import urllib.request
import json
import time
import sys

BASE = "http://localhost:8000/api/workspaces"

def req(path, method="GET", body=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"} if body else {}
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r) as response:
        return json.loads(response.read().decode())

def main():
    print("=== 1. Testing GET /api/workspaces/runtimes ===")
    runtimes = req("/runtimes")
    print(f"Total runtimes listed: {len(runtimes)}")
    avail = [r["id"] for r in runtimes if r["available"]]
    unavail = [r["id"] for r in runtimes if not r["available"]]
    print(f"Available: {avail}")
    print(f"Unavailable: {unavail}")
    assert "cpp" in avail, "C++ GCC must be available"
    assert "python" in avail, "Python must be available"
    assert "rust" in unavail, "Rust must be reported as not installed"

    print("\n=== 2. Creating C++ project from template 'starter-cpp' ===")
    ws = req("", method="POST", body={"name": "E2E C++ GCC Workspace", "template": "starter-cpp"})
    ws_id = ws["id"]
    print(f"Created workspace: {ws_id}")

    print("\n=== 3. Building C++ multi-file project with GCC 16.2.0 ===")
    build_res = req(f"/{ws_id}/build", method="POST")
    print(f"Build success: {build_res['success']}")
    print(f"Build time: {build_res['build_time']}s")
    print(f"Binary path: {build_res.get('binary_path')}")
    assert build_res["success"] is True, f"C++ build failed: {build_res['stderr']}"
    assert build_res["exit_code"] == 0

    print("\n=== 4. Running compiled C++ binary ===")
    run_res = req(f"/{ws_id}/run", method="POST")
    print(f"Run exit code: {run_res['exit_code']}")
    print(f"Run execution time: {run_res['execution_time']}s")
    print(f"Stdout:\n{run_res['stdout'].strip()}")
    assert run_res["exit_code"] == 0
    assert "Welcome to Solix C++ Workspace!" in run_res["stdout"]
    assert "Fibonacci(10) = 55" in run_res["stdout"]

    print("\n=== 5. Injecting C++ syntax error to verify GCC diagnostics parser ===")
    bad_code = '#include <iostream>\nint main() {\n    std::cout << "Missing semicolon"\n    return 0;\n}\n'
    req(f"/{ws_id}/files/main.cpp", method="PUT", body={"content": bad_code})

    err_build = req(f"/{ws_id}/build", method="POST")
    print(f"Build success: {err_build['success']}")
    print(f"Exit code: {err_build['exit_code']}")
    assert err_build["success"] is False
    problems = err_build.get("problems", [])
    print(f"Parsed {len(problems)} problem(s):")
    for p in problems:
        print(f"  -> [{p['severity'].upper()}] {p['file']}:{p['line']}:{p['column']}: {p['message']} (source: {p['source']})")
    assert len(problems) > 0, "Expected at least one parsed compiler diagnostic"
    assert any("semicolon" in p["message"].lower() or "expected" in p["message"].lower() for p in problems)

    print("\n=== 6. Creating Python project with Runtime Error to test Python traceback parser ===")
    py_ws = req("", method="POST", body={"name": "E2E Python Workspace", "template": "starter-python"})
    py_id = py_ws["id"]
    
    # Inject ZeroDivisionError
    div_zero = 'def calc():\n    return 10 / 0\n\nif __name__ == "__main__":\n    calc()\n'
    req(f"/{py_id}/files/main.py", method="PUT", body={"content": div_zero})
    
    py_run = req(f"/{py_id}/run", method="POST")
    print(f"Python run exit code: {py_run['exit_code']}")
    py_problems = py_run.get("problems", [])
    print(f"Parsed {len(py_problems)} problem(s) from traceback:")
    for p in py_problems:
        print(f"  -> [{p['severity'].upper()}] {p['file']}:{p['line']}:{p['column']}: {p['message']}")
    assert len(py_problems) > 0
    assert any("ZeroDivisionError" in p["message"] for p in py_problems)

    print("\n=== 7. Testing 10-second process timeout protection ===")
    hang_ws = req("", method="POST", body={"name": "E2E Hang Workspace", "template": "empty"})
    hang_id = hang_ws["id"]
    req(f"/{hang_id}/files", method="POST", body={"path": "sleep.py", "is_directory": False, "content": "import time\ntime.sleep(60)\n"})
    t0 = time.time()
    hang_res = req(f"/{hang_id}/run", method="POST", body={"command": "python sleep.py"})
    elapsed = time.time() - t0
    print(f"Hang test completed in {elapsed:.2f}s, timed_out={hang_res['timed_out']}, exit_code={hang_res['exit_code']}")
    assert hang_res["timed_out"] is True
    assert elapsed < 35, "Timeout should happen close to 30s"

    print("\n=======================================================")
    print("ALL 7 END-TO-END COMPILER & RUNTIME TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    main()
