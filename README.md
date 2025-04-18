# Web Perso – Nicolas Payen's Personal Website

This project powers the personal website of Nicolas Payen, including AI chatbot functionality, an interactive fine art photo gallery, article references, and career summaries.

---

## 🌐 Project Structure

```
web_perso/
│
├── api/                    # Serverless API endpoints for Vercel
│   ├── chatbot.js         # Handle NicoAI chatbot for a visitor
│   ├── init.js            # Initialise NicoAI chatbot
│   ├── gallery.js         # Function to manage the gallery
│   ├── resources.js       # Manage access to the resources made available to NicoAI
│   ├── generateCaption.js # Ask openAI to return title, description, tags for a picture
│   ├── conversations.js   # Returns a summary of all stored conversations in Vercel KV.
│   └── conversation       # used by chatbot backoffice
│        └── [visitorID]   # Folder to store the generated page for visitor conversations history.
│
├── lib/                   # folder used for libraries 
│   └──  updateGallery.js  # Manage change in the gallery.json and synchronisation with KV database 
│
├── utils/                 # folder used for tools 
│   ├── kvUtils.js         # functions usefull to manage the KV database in the backoffice
│   ├── loadresources.js   # return resources.json  
│   ├── notify.js          # pushover service to send live Notification to Nicolas 
│   ├── resourceMatcher.js # Match user question against both deep content and summaries.
│   ├── utils.js           $ the API to initiate NicoAI 
│
├── scripts/                        # Local/Build-time scripts
│   ├── generatePhotoPages.js       # Builds static HTML pages per photo 
│   ├── generateResourcesContent.js # Scrapes trusted URLs into `resourcesContent.json
│   ├── validateGallery.js          # validates Gallery.json for missing or malformed fields before upload
│   ├── uploadResources.js          # script to deploy the resources in KV database
│   └── runGalleryUpdate.js         # run updayteGallery.js
│
├── gallery/                # folder used for the gallery 
│   └── static/             # SEO pages automaticaly generated for each piece of art
│
│── images/                 # web_perso static images used across the website 
│
│── src/                    # store the files made available in the website (like my resume) 
│
├── photos/                 # Web-optimized images (synced manually from 'Gallery' project)
│   └── thumbs/             # Thumbnails for fast loading
│
├── public/                 # Static assets served by Vercel (optional)
├── gallery.html            # Photo gallery frontend
├── aboutphotography.html   # Info page on prints and materials
├── chatbot.js              # Frontend chatbot logic
├── resources.json          # Lists all reference materials (articles, resumes, etc.)
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
- Loads relevant context using:
  - `resources.json` (descriptions stored in Vercel KV)
  - `resourcesContent.json` (full parsed text content from trusted pages)
- Visitor messages are saved to Vercel KV with a unique `visitorID`.

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

| Script                    | Purpose                                                |
|--------------------------|--------------------------------------------------------|
| `updateGallery.js`       | Builds full `gallery.json` in KV using latest metadata |
| `generatePhotoPages.js`  | Builds static HTML pages per photo                     |
| `generateResourcesContent.js` | Scrapes trusted URLs into `resourcesContent.json`     |
| `validateGallery.js`     | Validates photo entries before upload                  |

---

## ✍️ Author

- Nicolas Payen  
- Visit: [web-perso.vercel.app](https://web-perso.vercel.app)