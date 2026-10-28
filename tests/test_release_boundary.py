from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_browser_does_not_persist_credentials():
    for path in (ROOT / "web/src/app/api-console").glob("*.ts*"):
        text = path.read_text()
        assert "localStorage.setItem(sessionStorageKey" not in text, path
        assert "apiKey=${" not in text, path
        assert "session.key.slice" not in text, path


def test_public_source_has_no_production_routing():
    prohibited = ("chatapi.", "infinite-canvas-", "QUANCHENG_HOST", "WODE_HOST", "/Users/")
    for path in (ROOT / "web/src").rglob("*"):
        if path.is_file():
            assert not any(value in path.read_text() for value in prohibited), path


def test_no_account_pool_or_cli_gateway():
    assert not (ROOT / "services/register").exists()
    for path in (ROOT / "platform_api").glob("*.py"):
        text = path.read_text()
        assert "subprocess" not in text
        assert "chatgpt.com/backend-api" not in text


def test_logout_and_expiry_share_draft_cleanup():
    page = (ROOT / "web/src/app/api-console/page.tsx").read_text()
    cleanup = page.split("const clearSession = useCallback(", 1)[1].split("useEffect(", 1)[0]
    for reset in ['setImagePrompt("")', 'setChatInput("")', "setChatMessages([])", "clearImageReferenceImages()"]:
        assert reset in cleanup
    assert "const expire = () => clearSession()" in page
    assert "const logout = () => {\n    clearSession()" in page
