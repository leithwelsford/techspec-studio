# Pandoc Export - Quick Testing Guide

**Purpose**: Verify Pandoc export implementation works end-to-end

**Time**: 5-10 minutes

---

## Prerequisites

✅ Node.js 18+ installed
✅ Pandoc installed (`pandoc --version`)
✅ Frontend and backend code deployed

---

## Step-by-Step Test

### 1. Start Backend Service

```bash
# Terminal 1: Start Pandoc service
cd server
npm install
npm start

# Expected output:
# ╔═══════════════════════════════════════════════════════════╗
# ║          TechSpec Studio - Pandoc Export Service          ║
# ╚═══════════════════════════════════════════════════════════╝
#
# ✓ Server running on port 3001
# ✓ Frontend URL: http://localhost:3000
# ✓ Health check: http://localhost:3001/api/health
#
# Ready to accept export requests...
```

### 2. Verify Backend Health

```bash
# Terminal 2: Test health check
curl http://localhost:3001/api/health

# Expected response:
# {
#   "status": "ok",
#   "service": "pandoc-export",
#   "pandoc": "pandoc 2.19.2",
#   "uptime": 1.234
# }
```

### 3. Start Frontend

```bash
# Terminal 2 (or Terminal 3): Start frontend
cd ..
npm run dev

# Expected output:
# VITE v5.2.0  ready in 234 ms
#
# ➜  Local:   http://localhost:3000/
# ➜  Network: use --host to expose
# ➜  press h to show help
```

### 4. Test in Browser

1. **Open Frontend**:
   - Navigate to http://localhost:3000
   - Create or load a specification with some content

2. **Prepare Test Template**:
   - Option A: Use any Word template you have (with headers/footers/logos)
   - Option B: Create simple template in Word:
     - Open Microsoft Word
     - Add header: "Company Logo" text + page numbers
     - Add footer: "Confidential - © 2025"
     - Save as `test-template.docx`

3. **Test Export**:
   - Click **"Export"** button in header
   - In Export Modal:
     - Select **"DOCX Document"** tab
     - Click **"Upload Template"** button
     - Choose your `test-template.docx` file
     - ✅ Verify: "Template loaded" green checkmark appears
     - ✅ Check: "Use uploaded template for export" checkbox
     - ✅ Check: "Use Pandoc (professional output...)" checkbox
     - ✅ Verify: "✓ Service ready" green indicator (NOT red warning)
     - ✅ Info box appears: "Pandoc Mode: Your template's headers, footers..."
   - Click **"Export"** button

4. **Verify Download**:
   - ✅ File downloads: `technical-specification.docx` (or your spec title)
   - ✅ No error alerts

5. **Verify Content in Word**:
   - Open downloaded DOCX in Microsoft Word
   - ✅ Header present: "Company Logo" + page numbers
   - ✅ Footer present: "Confidential - © 2025"
   - ✅ Content is complete (not empty, not just template)
   - ✅ Formatting looks professional

---

## Expected Results

### ✅ Success Indicators

- [ ] Backend health check returns HTTP 200
- [ ] Frontend shows "✓ Service ready" indicator
- [ ] "Use Pandoc" checkbox is NOT disabled
- [ ] Export completes without errors
- [ ] DOCX file downloads
- [ ] Template headers/footers present in output
- [ ] Content is complete and formatted

### ❌ Common Issues

**Issue**: ⚠️ Backend service not available

**Solution**:
```bash
# Check if backend is running
curl http://localhost:3001/api/health

# If not running, start it:
cd server && npm start
```

---

**Issue**: "Pandoc not installed" in health check

**Solution**:
```bash
# Install Pandoc
# Ubuntu/Debian
sudo apt-get install pandoc

# macOS
brew install pandoc

# Verify
pandoc --version
```

---

**Issue**: CORS errors in browser console

**Solution**:
```bash
# Check server/.env or server environment
echo "FRONTEND_URL=http://localhost:3000" > server/.env

# Restart backend
cd server && npm start
```

---

**Issue**: Export succeeds but template not applied

**Possible causes**:
1. "Use Pandoc" checkbox not checked → Only browser export ran
2. Pandoc version too old (need 2.10+) → Upgrade Pandoc
3. Template file corrupted → Try different template

**Debug**:
```bash
# Test Pandoc directly
echo "# Test" > test.md
pandoc test.md --reference-doc=template.docx -o output.docx
# Open output.docx and verify template applied
```

---

## Alternative: Docker Compose Test

```bash
# Start both services with Docker Compose
docker-compose up

# Wait for startup messages:
# frontend_1         | VITE v5.2.0  ready in 234 ms
# pandoc-service_1   | ✓ Server running on port 3001

# Test in browser (same steps as above)
# Frontend: http://localhost:3000
# Backend health: http://localhost:3001/api/health
```

---

## Command-Line Export Test

```bash
# Create test markdown
echo "# Test Specification

This is a test document.

## Section 1

Some content here." > test.md

# Export with Pandoc (using curl)
curl -X POST http://localhost:3001/api/export-pandoc \
  -F "markdown=@test.md" \
  -F "template=@test-template.docx" \
  -F 'options={"includeTOC":true,"includeNumberSections":true}' \
  -o output.docx

# Expected:
# File downloads: output.docx

# Verify
ls -lh output.docx
# Should be > 10KB

# Open in Word and verify template applied
```

---

## Test Checklist

Complete this checklist to verify full functionality:

- [ ] Backend starts without errors
- [ ] Health check endpoint responds with 200 OK
- [ ] Health check shows Pandoc version
- [ ] Frontend detects service as available
- [ ] Template upload works
- [ ] "Use Pandoc" checkbox appears and is enabled
- [ ] Export button triggers download
- [ ] Downloaded DOCX opens in Word
- [ ] Template headers present in output
- [ ] Template footers present in output
- [ ] Content is complete (not truncated)
- [ ] Document formatting looks professional
- [ ] Multiple exports work (no temp file issues)
- [ ] Backend logs show successful exports
- [ ] No errors in browser console
- [ ] No errors in backend console

---

## Success! 🎉

If all tests pass, Pandoc export is working correctly.

**Next Steps**:
1. Test with real corporate Word template
2. Test with larger specifications (50+ pages)
3. Test concurrent exports (multiple users)
4. Deploy to production environment

---

**Need Help?**

- Check [server/README.md](server/README.md) for backend troubleshooting
- Check [PANDOC_IMPLEMENTATION_COMPLETE.md](PANDOC_IMPLEMENTATION_COMPLETE.md) for architecture details
- Check backend logs: `cd server && npm start` (look for error messages)
- Check frontend console: F12 → Console tab
