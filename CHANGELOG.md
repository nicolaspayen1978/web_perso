# Changelog

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## \[2.0.0] – 2025-05-09

### 🚀 Added

* **NicoAI personality agent** with persistent chat and OpenAI context enrichment
* **GreenFundEU page integration** with embedded NicoAI assistant
* **AI-powered photo gallery backoffice** with:

  * Caption generation (title, description, tags)
  * Selective AI suggestions with checkbox UI
  * Print tracking fields (sold / total)
  * Edition format detection (L / XL / Artist)
* **SEO-friendly static HTML pages per photo** via `generatePhotoPages.js`
* **Gallery print metadata pipeline** (from RAW > dimensions > pricing)
* **Auto warnings** for insufficient resolution per edition size

### ⚙️ Changed

* **KV access refactored to REST API** for reliability & portability
* **All KV interactions moved to `lib/kvGalleryHelpers.js`** with unwrap logic
* **Switched to ESM syntax** across scripts and endpoints
* **Improved menu UI and layout for all pages**
* **Gallery photo visibility** toggle added per item
* **Exhibition tag support** for dynamic filtering

### 🧹 Removed

* Deprecated usage of `@vercel/kv` SDK
* Old static gallery entry templates
* Direct Node.js file-based updates inside API endpoints

---

## \[1.0.0] – 2023-2024

Initial launch:

* Static HTML site with career, articles, and gallery
* Embedded NicoAI prototype
* Manual gallery with basic print edition logic

---

👉 Visit [web-perso.vercel.app](https://web-perso.vercel.app) for the live version.
