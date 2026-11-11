### Architettura e Requisiti Tecnici:

1. SERVER-SIDE (Next.js API Route / Server Action):
   - Crea una Server Action o un'API Route `/api/screenshot` che riceve:
     - `url` (stringa)
     - `viewportWidth` (numero, es. 1440)
     - `viewportHeight` (numero, es. 900)
   - Usa `playwright` sul server per aprire l'URL con le dimensioni esatte del viewport specificato, attendere che la pagina sia completamente caricata (networkidle) e scattare uno screenshot a pagina intera o ad altezza viewport.
   - Restituisce l'immagine dello screenshot al client (come stringa Base64 o Blob).

2. FRONTEND / INTERFACCIA UTENTE (Client Components):
   - **Pannello di Controllo (Sidebar o Header):**
     - Input per l'URL del sito web.
     - Input via preset (mobile, tablet, desktop) per Viewport Width e Viewport Height.
     - Input file per caricare l'immagine di Figma (JPEG/PNG).
     - Slider per controllare l'Opacità dell'immagine di Figma (da 0% a 100%).
     - Selettore dei Blend Mode CSS: `difference` (predefinito), `normal`, `overlay`, `exclusion`.

   - **Area di Visualizzazione (Canvas / Viewer):**
     - Sovrapponi l'immagine generata dallo screenshot e l'immagine caricata da Figma, allineate in alto a sinistra.
     - Applica il `mix-blend-mode` selezionato e l'opacità per mostrare istantaneamente i pixel differenti (con il mode `difference`, i pixel identici diventano neri e le differenze si illuminano).
     - Aggiungi anche la modalità "Split Slider" (un divisore verticale trascinabile per confrontare prima/dopo a destra e sinistra).
     - aggiungi anche la modalita' tap per vedere sito o figma

3. EXTRA / OTTIMIZZAZIONI:
   - Gestisci gli stati di caricamento (loader/spinner mentre il server genera lo screenshot).
   - Aggiungi un pulsante per scaricare la mappa delle differenze o resettare la vista.
