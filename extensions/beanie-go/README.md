# Voiceflow Settings Integration

Diese Erweiterung ermöglicht die Integration von Voiceflow-Einstellungen aus den Shop-Metadaten in die Chat-Komponenten.

## Anleitung zur Installation

### 1. Snippet in Theme einfügen

Das `voiceflow_settings.liquid` Snippet muss manuell in den Header des Themes eingefügt werden. Dies stellt sicher, dass die Voiceflow-Einstellungen vor dem Laden der Chat-Komponenten verfügbar sind.

1. Öffnen Sie den Theme Editor
2. Navigieren Sie zum Layout > theme.liquid
3. Fügen Sie folgenden Code direkt vor dem schließenden `</head>` Tag ein:

```liquid
{% render 'voiceflow_settings' %}
```

### 2. Funktionsweise

Das Snippet lädt die Voiceflow-Einstellungen aus den Shop-Metadaten und stellt sie als globale Variable `window.VOICEFLOW_SETTINGS` zur Verfügung. Die Chat-Komponenten (Desktop und Mobile) verwenden diese Einstellungen automatisch.

Falls die Metadaten nicht verfügbar sind, werden Fallback-Einstellungen verwendet.

## Fehlerbehebung

Wenn die Chat-Komponenten die Voiceflow-Einstellungen nicht korrekt laden:

1. Prüfen Sie, ob das Snippet korrekt in den Header eingefügt wurde
2. Prüfen Sie in der Browser-Konsole, ob `window.VOICEFLOW_SETTINGS` korrekt gesetzt ist
3. Stellen Sie sicher, dass die Metadaten im Shop korrekt konfiguriert sind

## Komponenten

- `voiceflow_settings.liquid`: Snippet zum Laden der Einstellungen
- `chat-box.js`: Desktop-Chat-Komponente
- `chat-box-mobile.js`: Mobile-Chat-Komponente
- `voiceflow_Bubble.liquid`: Voiceflow Bubble-Komponente
