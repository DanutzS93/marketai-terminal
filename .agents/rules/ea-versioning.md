# Reguli de Versionare Expert Advisor (MT5 EA)

1. **Sursă Unică de Adevăr (`MT5_EA_VERSION`)**:
   - Orice modificare de versiune pentru Expert Advisor se face **exclusiv** în fișierul `src/utils/mql5Template.ts` prin constanta:
     ```typescript
     export const MT5_EA_VERSION = 'x.xx';
     ```
2. **Sincronizare Automată în Interfață**:
   - Titlurile din ferestrele modale (inclusiv `Mt5IntegrationModal.tsx`), badge-urile de conexiune (`RiskRulesConfigurationSection.tsx`, `PositionCalculatorModal.tsx`), instrucțiunile și comentariile MQL5 trebuie să utilizeze întotdeauna această constantă `MT5_EA_VERSION`.
   - Niciun număr de versiune nu se va hardcoda ca șir fix în componentele UI.

3. **Deployment**:
   - La fiecare bump de versiune sau modificare în logica EA/Bridge, se rulează `bun run lint`, `bun run build`, se face commit & push pe GitHub (`main`) și deployment imediat pe Fly.io (`flyctl deploy --remote-only`).
