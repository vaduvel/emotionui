# Adaptive UI Outcome Contract

Acest document fixeaza contractul dintre:
- semnale comportamentale
- stare inferata
- zona activa
- outcome-ul de UI injectat

Scop:
- tuning pe intentie reala
- adaptare locala, nu restilizare globala inutila
- consistenta intre MVP, extensie si rollout

## Principiu

UI-ul nu se schimba pe toata pagina pentru fiecare intent.

Regula de baza:
- `state global + zona activa -> adaptare locala`

Exceptii globale:
- `FRUSTRATED`
- `OVERWHELMED`

## Zone

- `overview`
  - hero, galerie, imagini, beneficii vizuale
- `variants`
  - storage, memory, configuratii
- `purchase`
  - pret, favorite, add to cart, buy now, finantare
- `research`
  - cluster unificat:
    - `description`
    - `specs`
    - `reviews`
    - `faq`
- `compare`
  - produse similare / alternative
- `benefits`
  - livrare, retur, seller trust
- `services`
  - upsells / servicii adiacente

## State Contract

### `CALM_BROWSING`
- semnal dominant:
  - user scaneaza produsul, fara research intens sau commerce intent explicit
- zone tipice:
  - `overview`
  - `variants`
- UI outcome:
  - `STANDARD`
  - adaptare minima
  - observe panel discret in `overview` sau `variants`
- nu facem:
  - focus comercial agresiv
  - noise reduction global

### `EXPLORING`
- semnal dominant:
  - user vede produsul, variantele, incearca sa inteleaga configuratia
- zone tipice:
  - `overview`
  - `variants`
- UI outcome:
  - `STANDARD`
  - micro-guidance local
  - accent pe comparabilitate si orientare

### `DEEP_RESEARCH`
- semnal dominant:
  - descriere/specs/reviews/faq
  - dwell mare in clusterul de informatie
- zona activa:
  - `research`
- UI outcome:
  - `RESEARCH_MODE`
  - adaptare la nivelul intregului cluster `research`
  - subsectiunea activa influenteaza copy-ul, nu relayout-ul separat
- nu facem:
  - patru UI-uri distincte pentru `description/specs/reviews/faq`

### `PRICE_SENSITIVE`
- semnal dominant:
  - pret, price history, rate, discount, voucher, revenire la pret
- zona activa:
  - `purchase`
  - uneori `compare`
- UI outcome:
  - `PRICE_ALERT_MODE`
  - price reassurance local
  - clarificare de valoare, rate, retur, livrare

### `REASSURANCE_SEEKING`
- semnal dominant:
  - trust loop, review confirm, seller confidence, retur, garantie
- zone tipice:
  - `research`
  - `benefits`
  - `purchase`
- UI outcome:
  - `NEGOTIATOR_MODE`
  - value reassurance local
  - se injecteaza acolo unde userul cauta confirmarea

### `DECISION_READY`
- semnal dominant:
  - add to cart, checkout, CTA reengage, reintoarcere clara in rail-ul de cumparare
- zona activa:
  - `purchase`
- UI outcome:
  - `EXPRESS_LANE`
  - simplificare locala in purchase rail
  - accent pe next step
- nu facem:
  - redesign global daca userul e doar gata sa cumpere

### `FRUSTRATED`
- semnal dominant:
  - rage click, dead click real, reversals, burst haotic, no progress loop
- validare importanta:
  - click pe thumbnails sau pe elemente intentionat interactive NU inseamna frustrare
- UI outcome:
  - `DESIGN_OXYGEN`
  - reducere globala de zgomot
  - focus pe task si calmare vizuala

### `OVERWHELMED`
- semnal dominant:
  - overload cognitiv, prea multe switch-uri, prea mult zgomot, densitate mare
- UI outcome:
  - `SPOTLIGHT_MODE`
  - simplificare globala si focus pe urmatorul pas relevant

## Special Rules

### Research cluster rule
- cand userul intra in `DEEP_RESEARCH`, adaptarea se aplica pe `research`
- subsectiunea activa (`description/specs/reviews/faq`) modifica:
  - copy
  - highlights
  - chips
- dar nu trebuie sa para patru moduri separate

### Gallery rule
- click pe thumbnails / imagini secundare:
  - inseamna `overview browsing`
  - nu `FRUSTRATED`
- galerie = explorare vizuala sau observare, nu frictiune

### Compare rule
- produse similare pe aceeasi pagina:
  - indica `hesitation / compare browsing`
  - nu `DEEP_RESEARCH` automat
- UI outcome:
  - adaptare locala in `compare`
  - shortlist / tradeoff / better-fit framing

### Commerce rebound rule
- daca userul a fost in research si revine clar la:
  - pret
  - favorite
  - add to cart
  - buy now
- atunci research nu trebuie sa ramana sticky prea mult

## Tuning Objectives

Urmarim:
- intrare corecta in state
- iesire la timp din state
- schimbare de UI suficient de vizibila, dar nu agresiva
- adaptare ancorata in zona activa

Semnale de regresie:
- research pare doar hover pe subsectiuni
- UI sare global pentru un intent local
- thumbnails aprind frustrat
- userul se muta in purchase, dar research ramane dominant prea mult
