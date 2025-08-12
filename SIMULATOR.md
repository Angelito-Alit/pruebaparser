# 🤖 IoT MQTT Simulator

Simulador completo de dispositivos ESP32 que envía datos de sensores a través de MQTT para probar el sistema de parseo.

## 🚀 Características

- **Simulación Multi-Dispositivo**: 4 ESP32 virtuales con ubicaciones diferentes
- **Formatos Múltiples**: Soporta formato pipe (`|`) y JSON
- **Mensajes Inválidos**: Genera automáticamente mensajes con errores para probar validación
- **Configuración Flexible**: Intervalos, duración y tasa de errores configurables
- **Monitoreo en Tiempo Real**: Muestra cada mensaje enviado con detalles

## 📦 Dispositivos Simulados

| ID | UUID | Ubicación | Temp Range | Humidity Range | Version |
|---|---|---|---|---|---|
| esp32-001 | 550e8400-e29b-41d4-a716-446655440001 | Sala Principal | 20-30°C | 40-80% | 1.0.1 |
| esp32-002 | 550e8400-e29b-41d4-a716-446655440002 | Cocina | 22-35°C | 30-70% | 1.0.2 |
| esp32-003 | 550e8400-e29b-41d4-a716-446655440003 | Dormitorio | 18-26°C | 45-75% | 1.1.0 |
| esp32-004 | 550e8400-e29b-41d4-a716-446655440004 | Garage | 15-40°C | 20-90% | 1.0.1 |

## 🎯 Tipos de Mensajes

### ✅ Mensajes Válidos

**Formato Pipe (70%):**
```
tt1754898288|uid550e8400-e29b-41d4-a716-446655440001|t25.5|h60.2|v1.0.1
```

**Formato JSON (30%):**
```json
{
  "timestamp": 1754898288,
  "uuid": "550e8400-e29b-41d4-a716-446655440001",
  "temperature": 25.5,
  "humidity": 60.2,
  "version": "1.0.1"
}
```

### ❌ Mensajes Inválidos (15%)

- UUID inválido
- Valores fuera de rango
- JSON malformado
- Campos faltantes
- Timestamps futuros
- Caracteres prohibidos

## 🛠️ Comandos de Uso

### Comandos NPM
```bash
# Simulación estándar (60 segundos)
npm run simulate

# Ráfaga rápida (30 segundos, cada 1 segundo)
npm run simulate:burst

# Simulación continua (hasta Ctrl+C)
npm run simulate:continuous

# Mostrar ayuda
npm run help

# Prueba rápida sin conectar
node test-simulator.js
```

### Opciones Avanzadas
```bash
# Duración personalizada (120 segundos)
node simulator.js --duration 120

# Intervalo personalizado (cada 3 segundos)
node simulator.js --interval 3

# Tasa de mensajes inválidos (25%)
node simulator.js --invalid-rate 0.25

# Combinación de opciones
node simulator.js --duration 300 --interval 2 --invalid-rate 0.2
```

## 📊 Ejemplo de Salida

```
🔌 Connecting to MQTT broker...
📡 Broker: mqtts://l46d1e5e.ala.us-east-1.emqxsl.com:8883
📤 Target topic: IDGS10-Pruebas-Sensores
✅ Connected to MQTT broker!
🤖 Simulating 4 ESP32 devices

🚀 Starting IoT Simulation...
⏱️  Duration: 60 seconds
📡 Message interval: 5 seconds
❌ Invalid message rate: 15.0%
==================================================

📦 [001] esp32-001 (Sala Principal)
    📤 tt1754898288|uid550e8400-e29b-41d4-a716-446655440001|t25.5|h60.2|v1.0.1
    📊 Format: pipe

🎯 [002] esp32-002 (Cocina)
    📤 {"timestamp":1754898293,"uuid":"550e8400-e29b-41d4-a716-446655440002","temperature":28.3,"humidity":45.7,"version":"1.0.2"}
    📊 Format: json

💥 [003] corrupted-data (Unknown)
    📤 tt1754898298|uid123456|t25.0|h50.0
    📊 Format: invalid
```

## 🔧 Configuración

El simulador utiliza las variables de entorno del archivo `.env`:

```bash
MQTT_BROKER_URL=mqtts://l46d1e5e.ala.us-east-1.emqxsl.com:8883
MQTT_USERNAME=IDGS10-Admin
MQTT_PASSWORD=iDGS10-IDGS10
MQTT_CA_PATH=./emqxsl_ca.pem
ALLOWED_TOPICS=IDGS10-Pruebas-Sensores
```

## 🧪 Pruebas

Para probar que el simulador está correctamente configurado:

```bash
# Verificar configuración
node test-simulator.js

# Simulación corta para pruebas
node simulator.js --duration 10 --interval 1
```

## 🎮 Uso Típico

1. **Desarrollo**: `npm run simulate:burst` para pruebas rápidas
2. **Testing**: `npm run simulate` para pruebas estándar
3. **Demo**: `npm run simulate:continuous` para demostraciones
4. **Debug**: `node simulator.js --duration 30 --invalid-rate 0.5` para probar manejo de errores

## 🚦 Control

- **Ctrl+C**: Detiene la simulación en cualquier momento
- El simulador se desconecta automáticamente al finalizar
- Todos los mensajes son enviados al topic configurado

¡Perfecto para probar tu parser IoT y validar el manejo de datos en tiempo real! 🎯
