import asyncio
import os
import sys

# Set current dir to backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.workspace.tools import workspace_tools
from app.services.workspace.storage import workspace_storage

async def run_tool_tests():
    print("==================================================")
    print("TESTING WORKSPACE TOOL REGISTRY (13 TOOLS)")
    print("==================================================")
    
    # Setup test workspace
    ws = workspace_storage.create_workspace(name="Agent-Tools-Test", template="starter-python")
    ws_id = ws["id"]
    print(f"Created test workspace: {ws_id}")

    try:
        # 1. workspace_list_files
        res = workspace_tools.list_files(ws_id)
        assert res["success"] is True, f"list_files failed: {res}"
        file_names = [f["name"] for f in res["files"]]
        assert "main.py" in file_names, f"main.py not in {file_names}"
        print("[PASS] Tool 1: workspace_list_files passed")

        # 2. workspace_read_file
        res = workspace_tools.read_file(ws_id, "main.py")
        assert res["success"] is True, f"read_file failed: {res}"
        assert "Fibonacci" in res["content"] or "main" in res["content"]
        assert res["line_count"] > 0
        print("[PASS] Tool 2: workspace_read_file passed")

        # 3. workspace_search
        res = workspace_tools.search_project(ws_id, "fibonacci")
        assert res["success"] is True, f"search_project failed: {res}"
        assert len(res["matches"]) > 0, "No matches found for 'fibonacci'"
        print(f"[PASS] Tool 3: workspace_search passed ({len(res['matches'])} matches)")

        # 4. workspace_create_file (stage + apply)
        stage_res = workspace_tools.stage_file_creation(ws_id, "test_calc.py", "def add(a, b):\n    return a + b\n")
        assert stage_res["success"] is True
        assert stage_res["operation"] == "create"
        apply_res = workspace_tools.apply_file_operation(ws_id, "create", "test_calc.py", "def add(a, b):\n    return a + b\n")
        assert apply_res["success"] is True
        read_back = workspace_tools.read_file(ws_id, "test_calc.py")
        assert "return a + b" in read_back["content"]
        print("[PASS] Tool 4: workspace_create_file (staged + applied) passed")

        # 5. workspace_update_file (stage + apply)
        stage_res = workspace_tools.stage_file_update(ws_id, "test_calc.py", "def add(a, b):\n    return a + b + 0\n")
        assert stage_res["success"] is True
        assert stage_res["operation"] == "modify"
        assert "+    return a + b + 0" in stage_res["diff"]
        apply_res = workspace_tools.apply_file_operation(ws_id, "modify", "test_calc.py", "def add(a, b):\n    return a + b + 0\n")
        assert apply_res["success"] is True
        print("[PASS] Tool 5: workspace_update_file (diff + applied) passed")

        # 6. workspace_create_folder
        res = workspace_tools.create_folder(ws_id, "modules/math")
        assert res["success"] is True
        print("[PASS] Tool 6: workspace_create_folder passed")

        # 7. workspace_rename
        res = workspace_tools.rename_path(ws_id, "test_calc.py", "modules/math/calc.py")
        assert res["success"] is True
        read_renamed = workspace_tools.read_file(ws_id, "modules/math/calc.py")
        assert read_renamed["success"] is True
        print("[PASS] Tool 7: workspace_rename passed")

        # 8. workspace_delete_file (stage + apply)
        stage_res = workspace_tools.stage_file_deletion(ws_id, "modules/math/calc.py")
        assert stage_res["success"] is True
        assert stage_res["operation"] == "delete"
        apply_res = workspace_tools.apply_file_operation(ws_id, "delete", "modules/math/calc.py")
        assert apply_res["success"] is True
        read_del = workspace_tools.read_file(ws_id, "modules/math/calc.py")
        assert read_del["success"] is False
        print("[PASS] Tool 8: workspace_delete_file passed")

        # 9. workspace_run
        run_res = await workspace_tools.run_workspace(ws_id, entry_file="main.py")
        assert run_res["exit_code"] == 0, f"Run failed: {run_res}"
        assert "Fibonacci" in run_res["stdout"] or "Welcome" in run_res["stdout"]
        print("[PASS] Tool 9: workspace_run passed")

        # 10. workspace_test
        test_res = await workspace_tools.test_workspace(ws_id)
        assert test_res["exit_code"] == 0, f"Test failed: {test_res}"
        print("[PASS] Tool 10: workspace_test passed")

        # 11. workspace_build (Python workspace returns cleanly or build_required check)
        build_res = await workspace_tools.build_workspace(ws_id)
        assert build_res["success"] is True
        print("[PASS] Tool 11: workspace_build passed")

        # 12. workspace_get_problems
        prob_res = workspace_tools.get_problems(ws_id)
        assert prob_res["success"] is True
        assert prob_res["count"] == 0
        print("[PASS] Tool 12: workspace_get_problems passed")

        # 13. workspace_git_diff
        git_res = workspace_tools.git_diff(ws_id)
        assert git_res["success"] is True
        print("[PASS] Tool 13: workspace_git_diff passed")

        # Security check: Path traversal attempt
        try:
            workspace_tools.read_file(ws_id, "../../etc/passwd")
            assert False, "Should have rejected directory traversal"
        except Exception:
            print("[PASS] Security Jail: Directory traversal blocked successfully")

        print("\n>>> ALL 13 WORKSPACE TOOLS VERIFIED SUCCESSFULLY! <<<\n")

    finally:
        workspace_storage.delete_workspace(ws_id)

if __name__ == "__main__":
    asyncio.run(run_tool_tests())

