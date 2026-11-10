---
name: vault
description: Legt eine Notiz aus der aktuellen Konversation im Obsidian-Vault (~/Documents/SecondBrain) ab, standardmäßig eine Zusammenfassung in Inbox/. Verwenden, sobald der Nutzer etwas im Vault, in Obsidian oder im Second Brain ablegen, speichern oder festhalten will – in beliebiger Formulierung, z. B. „/vault“, „leg das in den Vault“, „fass alles zusammen und leg das als Wissen in meinem Vault ab“, „ab ins Second Brain“, „speicher die Zusammenfassung in Obsidian“, „notier das im Vault“. Fällt eines der Wörter Vault, Obsidian oder Second Brain, gilt dieser Skill, auch wenn „Wissen“ oder „merk dir das“ dabei steht. Nicht für Claude-Memories (die liegen unter Claude/Memory/ und folgen dem Memory-System) und nicht für Pollmeier ONE („ab in ONE“).
argument-hint: "[was/wohin, z. B. 'nur die Entscheidungen' oder 'nach Projekte/PollmeierGmbH']"
---

# Notiz in den Vault legen

Vault: `~/Documents/SecondBrain`. Ziel ohne Angabe: `Inbox/` (der Nutzer sortiert selbst weiter).
Argumente: $ARGUMENTS

## Ablauf

1. **Inhalt bestimmen.** Ohne Argument: Zusammenfassung der Konversation. Mit Argument: genau das, was verlangt ist (z. B. nur Entscheidungen, ein Konzept, ein Code-Snippet, eine bestimmte Antwort im Wortlaut).
2. **Ziel bestimmen.** Nennt der Nutzer einen Ordner, diesen nehmen (bestehende Ordner mit `ls` prüfen, nicht raten; neue Unterordner nur anlegen, wenn ausdrücklich gewünscht). Sonst `Inbox/`. Nie unter `Claude/Memory/`, `.obsidian/` oder `.stfolder/` schreiben.
3. **Dateiname:** `YYYY-MM-DD <Titel>.md`, Titel deutsch, sprechend, 3–8 Wörter, ohne `/ : * ? " < > |`. Existiert die Datei schon, ` (2)` anhängen — nie überschreiben.
4. **Schreiben** mit dem Write-Tool, dann in einer Zeile den vollständigen Pfad nennen. Nicht den Inhalt im Chat wiederholen.

## Aufbau der Notiz

```markdown
---
erstellt: YYYY-MM-DD
quelle: Claude Code
projekt: <Repo-/Ordnername des Arbeitsverzeichnisses, oder weglassen bei ~>
tags: [claude, <1–3 Themen-Tags>]
---

# <Titel>

**Kurzfassung:** 2–3 Sätze: worum ging es, was ist rausgekommen.

## Ergebnis / Entscheidungen
- …

## Wichtige Details
Fakten, Zahlen, Befehle, Pfade, Code — alles, was man später wirklich nachschlagen will.

## Offen / Nächste Schritte
- [ ] …
```

Abschnitte ohne Inhalt weglassen. Bei einer Einzelnotiz (Konzept, Snippet) statt dieses Gerüsts frei strukturieren, Frontmatter bleibt.

## Regeln

- Schreiben wie eine Notiz für das eigene künftige Ich: eigenständig verständlich ohne die Konversation, keine Gesprächsnacherzählung („dann fragte der Nutzer…“).
- Konkretes behalten (Pfade, Commit-Hashes, Zahlen, Namen von Tools/Dateien), Hin und Her weglassen.
- Verweise auf bestehende Vault-Notizen als `[[Notizname]]` setzen, wenn sie offensichtlich passen; Memories ebenso (z. B. `[[no-api-costs-without-consent]]`).
- Keine Secrets, Tokens oder Passwörter übernehmen. Personenbezogene Interna nur, wenn sie für die Notiz nötig sind — der Vault wird per Syncthing auf andere Geräte synchronisiert.
