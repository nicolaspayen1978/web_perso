# Web Perso – Nicolas Payen's Personal Website

This project powers the personal website of Nicolas Payen, including AI chatbot functionality, an interactive fine art photo gallery, article references, and career summaries.

> See [CHANGELOG.md](./CHANGELOG.md) for recent updates (v2.0 includes NicoAI, backoffice AI tools, and KV REST migration).

---

## 🌐 Project Structure

```
web_perso/
│
├── api/                         # Serverless API endpoints for Vercel
│   ├── chatbot.js               # Handle NicoAI chatbot for a visitor
│   ├── init.js                  # Initialise NicoAI chatbot
│   ├── gallery.js               # Function to manage the gallery
│   ├── resources.js             # Manage access to the resources made available to NicoAI
│   ├── generateCaption.js       # Ask OpenAI to return title, description, tags for a picture
│   ├── conversations.js         # Returns a summary of all stored conversations in Vercel KV
│   └── conversation.js          # Generated page info for a given visitor conversation history
│
├── lib/
│   ├── gallery_KVHelpers.js        # Robust get/set/scan of gallery:json in KV with format unwrapping
│   └── gallery_updateFromJson.js   # Load gallery.json from disk, validate, and push to KV
│
├── utils/
│   ├── chatAI_extractRelevantSummaries.js  # Generate context-aware summaries for selected resources
│   ├── chatAI_KVHelpers.js         # Helpers to manage KV storage from the backoffice
│   ├── chatAI_loadresources.js     # Return parsed resources.json
│   ├── chatAI_notify.js            # Push notifications to Nicolas
│   ├── chatAI_resourceMatcher.js   # Match user questions to content + summaries
│   └── chatAI_utils.js             # NicoAI core initialization logic
│
├── scripts/
│   ├── generatePhotoPages.js       # Builds static HTML pages per photo
│   ├── enrichResourcesWithAI.js    # Generate OpenAI-based enrichment of each resource
│   ├── generateResourcesContent.js # Scrapes trusted URLs into `resourcesContent.json`
│   ├── validateGallery.js          # Validates gallery.json for completeness and format
│   ├── uploadResources.js          # Deploys resources.json to KV
│   └── runGalleryUpdate.js         # Syncs gallery state from local to KV
│
├── gallery/
│   └── static/                     # SEO pages automatically generated for each piece of art
│
├── images/                         # Static images used across the website
├── photos/                         # Web-optimized images (synced manually from 'Gallery' project)
│   └── thumbs/                     # Thumbnails for fast loading
├── public/                         # Static assets served by Vercel (optional)
├── src/                            # Files made available in the website (like resumes)
│
├── gallery.html                    # Photo gallery frontend
├── backofficegallery.html         # Backoffice to administrate the gallery (incl. AI tools)
├── aboutphotography.html          # Info page on prints and materials
├── digitalEnabledGreenImpactFund.html # GreenFundEU strategy memo + embedded NicoAI
├── chat.html                       # Main page for NicoAI
├── chatbot.js                      # Frontend chatbot logic
├── backoffice.html                 # Backoffice to administrate the NicoAI chat
├── personalityProfile.md           # Personality profile of NicoAI
├── originals_metadata.json         # Metadata file generated externally
├── menu.js                         # Menu toggle logic
├── resources.json                  # Lists all reference materials (articles, resumes, etc.)
├── CHANGELOG.md                    # Project change history
└── ...
```

---

## 📸 Gallery Workflow (Manual + Scripted)

1. **Preparation in external `Gallery` project**
   - Run `localResizeScript.js` to generate:
     - `photos/` (resized display images)
     - `photos/thumbs/` (thumbnails)
     - `originals_metadata.json` (metadata including size & aspect ratio)

2. **Copy into `web_perso`**
   - Move `photos/`, `thumbs/`, and `originals_metadata.json` into the project.

3. **Update KV-backed gallery**
   ```bash
   npm run update-gallery
   ```

4. **Validate before production**
   ```bash
   npm run build
   ```

---

## 🧠 NicoAI Chatbot

- Powered by OpenAI API  
- Combines:
  - Static resource summaries (`resources.json` in KV)
  - Full content snippets (`resourcesContent.json`)
  - Visitor message history (per `visitorID`)
- Accessible from `/chat.html` and embedded in other pages (e.g. GreenFundEU)
- Built using:
  - Dynamic prompt + retrieval
  - Selective enrichment via OpenAI
  - Chat interface with persistent context

### 🧪 OpenAI Evaluation

> *"NicoAI is a clever demonstration of OpenAI API orchestration. It integrates structured and unstructured data into context-rich interactions. The backend includes fallback logic, validation, and enrichment pipelines. The gallery editor and article resource tools show real-world usability and care. It’s a strong proof of concept for a personalized, context-aware AI agent."* — ChatGPT system review

### 🤖 Concept Summary

- Interacts with visitors the same way Nicolas prefers ChatGPT/Lily to engage with him  
- Understands Nicolas’ views on climate change and personal work  
- Developed with help from ChatGPT  
- Architecture is reusable for other agents or use cases  

---

## ⚙️ Deployment

### Local development

```bash
vercel dev
```

### Production build

```bash
npm run build     # Validates gallery and generates content  
npm run deploy    # Deploys to Vercel prod
```

---

## 🔐 Environment Variables (set via Vercel dashboard)

```env
# Common
KV_MODE = prod
KV_REST_API_URL=
KV_REST_API_TOKEN=
BACKOFFICE_PASSWORD=

# Dev (if separate KV used)
KV_MODE = dev
DEV_KV_REST_API_URL=
DEV_KV_REST_API_TOKEN=
```

---

## 🛠 Key Build Scripts

| Script                      | Purpose                                                    |
|----------------------------|------------------------------------------------------------|
| `updateGallery.js`         | Builds full `gallery.json` in KV using latest metadata     |
| `generatePhotoPages.js`    | Builds static HTML pages per photo                         |
| `generateResourcesContent.js` | Scrapes trusted URLs into `resourcesContent.json`         |
| `enrichResourcesWithAI.js` | Adds OpenAI-generated summaries/tags to resources          |
| `validateGallery.js`       | Validates photo entries before upload                      |

---

## 📦 Release Notes

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

---

## ✍️ Author

- Nicolas Payen  
- Visit: [web-perso.vercel.app](https://web-perso.vercel.app)
