# Telegram Bot Setup for n8n Job Scraper

## 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a name (e.g., `Internship Hunt Bot`)
4. Choose a username (e.g., `internship_hunt_jenilbot`)
5. **Copy the bot token** — looks like: `7123456789:AAH...`

## 2. Get Your Chat ID

1. Send any message to your new bot
2. Open this URL in a browser (replace `YOUR_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
3. Find `"chat":{"id": XXXXXXX}` in the JSON response
4. **Copy the chat ID number** (e.g., `123456789`)

> **Tip:** For a group chat, add the bot to the group, send a message, then check `getUpdates`. Group IDs are negative numbers (e.g., `-1001234567890`).

## 3. Add Telegram Credential in n8n

1. Open n8n UI: `http://localhost:5678`
2. Go to **Settings** → **Credentials** → **Add Credential**
3. Search for **Telegram API**
4. Paste your **Bot Token**
5. Click **Save**

## 4. Configure the Workflow

After importing `job_auto_discovery_workflow.json`:

1. Open the **Telegram Notify** node
2. Click the credential dropdown → select your Telegram credential
3. Update the **Chat ID** field with your chat ID
4. Also update credentials for:
   - **Fetch Existing Jobs** → your PostgreSQL credential
   - **Gemini Quick Score** → your Google Gemini credential

## 5. Set the Webhook Base URL

Add this to your `.env` file:

```bash
# For local development
WEBHOOK_BASE_URL=http://localhost:5678

# For production (update when deploying)
# WEBHOOK_BASE_URL=https://your-n8n-instance.com
```

## 6. Activate the Workflow

1. Toggle the workflow to **Active** in the top-right
2. The cron will trigger at 9am, 1pm, and 6pm EST automatically
3. To test immediately, click **Test Workflow** (uses manual trigger)
