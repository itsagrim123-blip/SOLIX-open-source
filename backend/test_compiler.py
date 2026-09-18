import asyncio
import os
from pathlib import Path
import shutil
import sys
import tempfile
sys.path.insert(0, str(Path(__file__).parent))

from app.services.workspace.compiler import compiler_service

async def main():
    tmp_dir = Path(tempfile.mkdtemp(prefix="solix_test_cpp_"))
    try:
        # Create multi-file C++ project: main.cpp + utils.cpp + include/utils.h
        (tmp_dir / "include").mkdir()
        (tmp_dir / "include" / "utils.h").write_text("""#pragma once
#include <string>
std::string get_greeting(const std::string& name);
""", encoding="utf-8")

        (tmp_dir / "utils.cpp").write_text("""#include "include/utils.h"
std::string get_greeting(const std::string& name) {
    return "Hello " + name + " from Solix C++ Compiler!";
}
""", encoding="utf-8")

        (tmp_dir / "main.cpp").write_text("""#include <iostream>
#include "include/utils.h"

int main() {
    std::cout << get_greeting("Developer") << std::endl;
    return 0;
}
""", encoding="utf-8")

        print("Building C++ project in", tmp_dir)
        res = await compiler_service.build("test-cpp-ws", tmp_dir)
        print("Build success:", res.success)
        print("Build exit code:", res.exit_code)
        print("Build time:", res.build_time, "s")
        print("Problems count:", len(res.problems))
        print("Binary path:", res.binary_path)

        assert res.success, f"Build failed: {res.stderr}"
        assert res.binary_path and os.path.exists(res.binary_path)

        # Execute the compiled binary
        import subprocess
        run_res = subprocess.run([res.binary_path], capture_output=True, text=True)
        print("Execution stdout:", run_res.stdout.strip())
        assert "Hello Developer from Solix C++ Compiler!" in run_res.stdout

        # Now test compiler error
        (tmp_dir / "main.cpp").write_text("""#include <iostream>
int main() {
    std::cout << missing_variable << std::endl;
    return 0;
}
""", encoding="utf-8")
        err_res = await compiler_service.build("test-cpp-ws", tmp_dir)
        print("Error build success:", err_res.success)
        print("Error build problems:", len(err_res.problems))
        assert not err_res.success
        assert len(err_res.problems) >= 1
        assert err_res.problems[0].line == 3
        print("Diagnostic problem:", err_res.problems[0])

        print("ALL COMPILER TESTS PASSED FLAWLESSLY!")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

if __name__ == "__main__":
    asyncio.run(main())

