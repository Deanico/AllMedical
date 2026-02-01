# SSL/HTTPS Setup Guide for AllMedical

## The Problem
Your site shows "Not secure" because it's being served over HTTP instead of HTTPS.

## Solutions by Hosting Provider

### Option 1: Azure Static Web Apps or App Service (Easiest)
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your web app resource
3. Go to **Settings** > **TLS/SSL settings**
4. Turn on **HTTPS Only**
5. Azure automatically provides a free managed SSL certificate
6. Your custom domain will be automatically secured

### Option 2: Using Let's Encrypt (Free SSL Certificates)

If you're hosting on a VM or custom server:

#### Install Certbot
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

#### Obtain SSL Certificate
```bash
sudo certbot --nginx -d insulinpumpsupply.com -d www.insulinpumpsupply.com
```

#### Auto-renewal
Certbot automatically sets up renewal. Test it with:
```bash
sudo certbot renew --dry-run
```

### Option 3: Cloudflare (Free SSL + CDN)
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain: insulinpumpsupply.com
3. Update your domain's nameservers to Cloudflare's (provided after signup)
4. In Cloudflare dashboard:
   - Go to **SSL/TLS** > **Overview**
   - Set SSL mode to **Full** or **Full (strict)**
5. HTTPS will be enabled automatically (usually within 24 hours)

**Benefits:**
- Free SSL certificate
- DDoS protection
- CDN (faster loading worldwide)
- Easy DNS management

### Option 4: Using nginx Reverse Proxy

1. **Install nginx:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install nginx
   
   # CentOS/RHEL
   sudo yum install nginx
   ```

2. **Copy the nginx.conf file to nginx:**
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/allmedical
   sudo ln -s /etc/nginx/sites-available/allmedical /etc/nginx/sites-enabled/
   ```

3. **Get SSL certificate with Certbot:**
   ```bash
   sudo certbot --nginx -d insulinpumpsupply.com
   ```

4. **Test and restart nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Verify HTTPS is Working

After setup, test your site:
1. Visit https://insulinpumpsupply.com
2. Check for the padlock icon in the browser
3. Test at [SSL Labs](https://www.ssllabs.com/ssltest/)

## DNS Configuration

Make sure your domain points to your server:
```
A Record: insulinpumpsupply.com → Your Server IP
A Record: www.insulinpumpsupply.com → Your Server IP
```

## Current Status
- ❌ HTTP (Not Secure) - Current
- ✅ HTTPS (Secure) - After fix

## Quick Fix Checklist
- [ ] Identify hosting provider (Azure, AWS, custom server)
- [ ] Enable HTTPS/SSL at hosting level
- [ ] Update DNS if using Cloudflare
- [ ] Test site with https://
- [ ] Force redirect HTTP to HTTPS
- [ ] Verify padlock appears in browser

---

**Note:** The console errors you're seeing (`runtime.lastError`) are from browser extensions and are NOT related to your site's security. They can be ignored.
