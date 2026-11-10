---
name: inbox-aufraeumen
description: Räumt die Inbox des Obsidian-Vaults (~/Documents/SecondBrain/Inbox) auf. Notizen mit eindeutigem Ziel verschiebt er in den passenden Ordner, bei unklaren stellt er Rückfragen in einer Notiz und setzt beantwortete Rückfragen um. Wird von Hand gestartet mit „/inbox-aufraeumen“, „räum die Inbox auf“ oder „sortier meine Vault-Inbox“.
---

# Vault-Inbox aufräumen

Vault: `~/Documents/SecondBrain`. Rückfragen-Notiz: `Inbox/_Rückfragen Inbox.md`. Protokoll: `Claude/Inbox-Protokoll.md`.

## Ablauf

1. **Beantwortete Rückfragen zuerst umsetzen.** In der Rückfragen-Notiz jeden Block lesen, dessen Zeile `Antwort:` ausgefüllt ist:
   - `ok` / `ja` → den Vorschlag umsetzen
   - ein Ordnerpfad → dorthin verschieben (neuen Ordner nur anlegen, wenn der Nutzer ihn so hingeschrieben hat)
   - `bleibt` → in der Inbox lassen und nicht mehr nachfragen (Notiz behält den Block mit `Antwort: bleibt`)
   - `löschen` → nach `.inbox-trash/` verschieben (nie wirklich löschen)
   - sonst unklar → Block stehen lassen und ergänzen: `Rückfrage: <was unklar ist>`

   Erledigte Blöcke aus der Notiz entfernen.
2. **Ordnerstruktur erfassen:** `find ~/Documents/SecondBrain -type d -not -path '*/.*'` und je Ordner ein paar Dateinamen, damit erkennbar ist, was wohin gehört.
3. **Jede übrige Inbox-Datei lesen** (außer `_Rückfragen Inbox.md` und Dateien mit `Antwort: bleibt`) und einordnen:
   - **Sicher** = Thema passt eindeutig zu genau einem bestehenden Ordner (z. B. Workout → `Sport/Krafttraining/Workouts`, Pollmeier-ONE-Thema → `Projekte/PollmeierGmbH/Wissensdatenbank`). Dann verschieben.
   - **Unsicher** = mehrere Ordner kommen in Frage, kein Ordner passt oder ein neuer Ordner wäre nötig. Dann einen Block in die Rückfragen-Notiz schreiben, nicht verschieben.
   Im Zweifel unsicher. Lieber einmal zu viel fragen als falsch einsortieren.
4. **Verschieben** mit `mv -n` (nie überschreiben). Gibt es den Namen am Ziel schon, ` (2)` anhängen. Dateinamen und Inhalt nicht ändern.
5. **Protokoll:** Für jeden Lauf in `Claude/Inbox-Protokoll.md` oben einen Abschnitt `## YYYY-MM-DD HH:MM` einfügen, mit einer Zeile pro Datei: `verschoben: <Datei> → <Ordner>` bzw. `Rückfrage: <Datei>`. Gab es nichts zu tun, nur `nichts zu tun`.
6. **Antwort im Chat:** eine kurze Liste, was wohin verschoben wurde. Gibt es offene Rückfragen, diese direkt im Chat stellen (je Notiz Vorschlag und Alternativen). Die Antworten sofort umsetzen und den Block aus der Rückfragen-Notiz entfernen. Unbeantwortete Rückfragen bleiben in der Notiz stehen.

## Format der Rückfragen-Notiz

```markdown
# Rückfragen Inbox

Unter jeder Notiz `Antwort:` ausfüllen: `ok` (Vorschlag), einen Ordnerpfad, `bleibt` oder `löschen`. Wird beim nächsten Lauf umgesetzt.

## [[<Notizname ohne .md>]]
<1 Satz, worum es geht>
Vorschlag: `<Ordner>`, weil <kurzer Grund>
Alternativen: `<Ordner>`, `<Ordner>` (oder neuer Ordner `<Pfad>`)
Antwort:
```

Bestehende offene Blöcke nicht doppelt anlegen.

## Grenzen

- Nur Dateien direkt in `Inbox/` anfassen, keine Unterordner und nichts außerhalb, außer dem Zielordner, `.inbox-trash/` und dem Protokoll.
- Nie in `Claude/Memory/`, `.obsidian/`, `.stfolder/` schreiben oder dorthin verschieben.
- Nichts löschen, keine Inhalte ändern, keine neuen Ordner auf eigene Faust anlegen.
