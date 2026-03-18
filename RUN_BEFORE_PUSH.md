# ⚠️ Run These SQL Scripts Before Pushing

## Required Database Updates

You've added new features that require database changes. Run these SQL scripts in your Supabase SQL Editor **before pushing your code**.

---

## 1️⃣ Physician Order Tracking (Required)

**File:** `web/add-physician-order-tracking.sql`

**What it does:** Adds columns to track physician order workflow (Generate → Send → Receive)

**How to run:**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste the contents of `web/add-physician-order-tracking.sql`
4. Click "Run"

---

## 2️⃣ Physician Order File Storage (Required)

**File:** `web/add-physician-order-storage.sql`

**What it does:** Creates a storage bucket for uploading signed physician orders

**How to run:**
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste the contents of `web/add-physician-order-storage.sql`
4. Click "Run"

---

## ✅ After Running Both Scripts

You're ready to push! The new features will work:
- **Physician Order Workflow:** Track when orders are generated, sent, and received
- **File Uploads:** Attach signed physician orders to client profiles
- **Edit Doctors:** Update doctor information without re-adding them
- **Clean Names:** Physician names in orders won't have credentials or commas

---

## 🚀 What Changed in This Update

### New Features
1. **Physician Order Tracking Workflow**
   - Visual progress tracker (Generated → Sent → Received)
   - "Mark as Sent" button after generating order
   - "Upload Signed Order" button when order comes back

2. **File Attachments**
   - Upload signed physician orders (PDF, DOC, Images)
   - View attached files from client profile
   - Files stored securely in Supabase Storage

3. **Edit Doctor Info**
   - Edit button on each doctor card
   - Update name, NPI, phone, fax, address
   - No need to delete and re-add doctors

4. **Improved Name Formatting**
   - Removes credentials (M.D., D.O., etc.) from physician names in orders
   - Cleans up commas and extra punctuation

### Bug Fixes
- Fixed birthday dates being off by one day (timezone issue)
- Fixed edit form showing different birthday than display
- Button text changes to "Regenerate" after first order generation

---

## 📝 Quick Checklist

- [ ] Run `web/add-physician-order-tracking.sql` in Supabase
- [ ] Run `web/add-physician-order-storage.sql` in Supabase
- [ ] Test the physician order workflow in your app
- [ ] Push to GitHub
- [ ] Deploy updated code

