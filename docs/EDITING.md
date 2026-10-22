# Editing Smart Syllabus

Open **yoursite/admin/** and click **Login with GitHub**.

## The one rule to remember

**The Save button saves. The Status field decides what's on the website.**

| Status | On the website? |
|---|---|
| Draft | No. Work in progress. |
| Published | Yes, *if* every page above it is also published. |
| Hidden | No. Taken down; you can republish later. |
| Archived | No. Visitors to its address are sent to the page above it. |

After saving a Published page, the site updates in **1–3 minutes**. Refresh to see it.

## Create a page

1. **Pages → New page**.
2. Type the **Page title**. The address is made from it automatically (you can set a **URL name** instead).
3. Leave **Status: Draft** while writing. The **preview** on the right shows exactly how it'll look, its address and where it'll appear in the menu.
4. Click **Save** whenever you like. Change Status to **Published** and Save again to put it online.

## Make subpages (any depth)

1. Save the parent page first. A page must be saved before it appears in the dropdown.
2. Create the new page and choose it under **Parent page**.
3. **Order** sets the position among pages with the same parent (10, 20, 30…).
4. **Show in navigation:** *Automatic* puts top-level pages in the menu, their subpages in its dropdown, and everything in the section sidebar. *Sidebar only* and *Hidden from menus* give you more control.

**Move a page:** pick a different Parent page and save. Its subpages move with it, and old addresses redirect automatically.
**Rename:** change the title or URL name and save. The old address redirects too.

## Add content to a page

Click **Add block** and choose:

| Block | Use it for |
|---|---|
| Text | Paragraphs, lists, bold, links |
| Section heading | Starts a new section (big handwritten heading) |
| Links | A list of links with descriptions, "official source" ticks and verified dates |
| Document / download | PDFs, Word, PowerPoint, Excel, TXT, uploaded **or** linked from elsewhere |
| Video or audio | YouTube (embedded), an uploaded MP3/small MP4, or an external file link |
| Image / Image gallery | Pictures (always describe the image for screen readers) |
| Table | Copy cells from Excel/Google Sheets and **paste** them in |
| Callout / Cards / FAQ / Buttons | Coloured notes, link cards, questions, buttons |

Drag blocks by their handle to reorder. Use the trash icon to remove one.

**Linking to your own pages:** use **Link to a page on this site** (a dropdown) rather than typing the address. That way the link keeps working when pages move.

### Upload vs embed vs link

| You have… | Do this | On the site |
|---|---|---|
| PDF, image, TXT | Upload | Opens in the browser + Download |
| Word / PowerPoint / Excel | Upload | Download button (opens in Office / Google apps) |
| MP3, small MP4 (under ~25 MB) | Upload | Audio/video player |
| Video of any size | Put it on YouTube, paste the link | Embedded player |
| Big files, Google Drive files | "Link to a file stored elsewhere" | Open link button |

**Replace an outdated document:** open the block, choose a new file and save. Title and description stay.

## Notices and disclaimers

Every block, link, page and university has **Add notice**:

- **Use a saved notice:** pick one from the **Notice library**. Edit it there once and it changes everywhere it's used. Set it to *Retired* to hide it everywhere.
- **Write a one-off notice:** just for this spot.

Choose **where** it appears (before, right after, end of section, bottom of page) and its **style**: subtle note, highlighted warning, information, or source/verification with a source link and verified date. You can add several notices to one item.

Notices don't replace checking facts. Use each university's **Are the facts checked?**, source and verified-date fields for that.

## Universities

**Universities** has one entry per course, imported exactly from your spreadsheet. Each has **Review flags**: things to check. Delete a flag once you've checked it, and fill in the official course page, currency, source and last-verified date as you go.

## Home page and site settings

**Site settings → Home page** edits the heading, intro and buttons. Tick **Feature on the home page** on any page to show it there. **Site name, menu and footer** has the site name, footer text and your feedback form link.

## Back up your content

Everything is saved in your GitHub repository, with full history (every save is a version). To download a copy: repository page → **Code → Download ZIP**. To undo a mistake, ask for help restoring an earlier version from GitHub's history.

## When a save doesn't appear

Check the repository's **Actions** tab (the "Check pages" run) or the failed deployment in Vercel. A red ✗ means the site wasn't updated; click it to read the plain-English reason (e.g. two published pages would share an address, or a page's parent was deleted). Fix it in the dashboard and save again. The live site keeps its last good version meanwhile.
