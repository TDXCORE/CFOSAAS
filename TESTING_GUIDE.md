# 🧪 GUÍA DE EJECUCIÓN DE PRUEBAS - CFO SaaS Platform

## 📋 **PREPARACIÓN PARA TESTING**

### **Requisitos Previos:**
1. ✅ Aplicación desplegada y accesible
2. ✅ OpenAI API key configurada en Vercel
3. ✅ Archivos de prueba XML disponibles en `/test-files/`
4. ✅ Navegadores de prueba: Chrome, Firefox, Safari
5. ✅ Dispositivos para responsive testing
6. ✅ Herramientas de developer tools activadas

### **URLs y Credenciales:**
- **URL Producción:** [Tu URL de Vercel]
- **Credenciales Test:** [Configurar según tu auth setup]
- **Empresas Test:** Crear durante testing

---

## 🚀 **ORDEN DE EJECUCIÓN RECOMENDADO**

### **FASE 1: Validación Básica (30 minutos)**
Ejecutar en este orden para validar funcionalidad core:

1. **TEST-UI-001** - Carga inicial y autenticación
2. **TEST-UI-002** - Navegación entre páginas  
3. **TEST-UI-003** - Selector de empresas
4. **TEST-COMP-001** - Creación de empresas

**CRITERIO DE CONTINUACIÓN:** Si alguno falla crítico, PARAR y reportar

### **FASE 2: AI CFO (45 minutos)**  
5. **TEST-AI-001** - Conexión y respuesta básica
6. **TEST-AI-002** - Inteligencia financiera colombiana
7. **TEST-AI-003** - Análisis de contexto empresarial

### **FASE 3: Procesamiento de Facturas (60 minutos)**
8. **TEST-INV-001** - Carga de archivo XML UBL
9. **TEST-INV-002** - Extracción de datos XML
10. **TEST-INV-003** - Clasificación PUC automática
11. **TEST-INV-004** - Cálculos tributarios
12. **TEST-INV-005** - Análisis AI de facturas

### **FASE 4: Dashboard y Métricas (30 minutos)**
13. **TEST-DASH-001** - Visualización de métricas
14. **TEST-DASH-002** - Filtros y rangos de fecha

### **FASE 5: Manejo de Errores (30 minutos)**
15. **TEST-ERR-001** - Archivos inválidos
16. **TEST-ERR-002** - Límites y restricciones
17. **TEST-ERR-003** - Conectividad AI

### **FASE 6: Casos de Uso E2E (60 minutos)**
18. **CASO-E2E-001** - Flujo completo empresario PYME
19. **CASO-E2E-002** - Flujo contador/asesor

**TIEMPO TOTAL ESTIMADO:** 4.5 horas

---

## 📁 **ARCHIVOS DE PRUEBA**

### **XMLs de Facturas (usar en TEST-INV-###):**
```
/test-files/
├── factura_ejemplo_01_servicios.xml     → Servicios profesionales $1M
├── factura_ejemplo_02_productos.xml     → Productos oficina $500K  
├── factura_ejemplo_03_arrendamiento.xml → Arriendo $2M
├── xml_malformado_test.xml              → Para testing errores
└── facturas_lote.zip                    → (crear con múltiples XMLs)
```

### **Datos de Prueba Sugeridos:**

**Empresa 1:**
- Nombre: "PYME DEMO SERVICIOS SAS"
- NIT: 900123456-1
- Actividad: Servicios profesionales
- Ciudad: Bogotá

**Empresa 2:**  
- Nombre: "COMERCIALIZADORA TEST LTDA"
- NIT: 800987654-2
- Actividad: Comercio
- Ciudad: Medellín

---

## 🔍 **INSTRUCCIONES ESPECÍFICAS POR TEST**

### **TEST-AI-002: Preguntas Exactas a Usar**

```
1. "¿Cuál es la tarifa actual del IVA en Colombia?"
   RESPUESTA ESPERADA: 19% (tarifa general)

2. "¿Cuándo debo aplicar retención en la fuente por servicios?"
   RESPUESTA ESPERADA: Servicios > 4 UVT ($188,260 en 2024)

3. "¿Qué es el PUC y para qué sirve?"
   RESPUESTA ESPERADA: Plan Único de Cuentas para clasificación contable

4. "¿Cómo calculo el ICA en Bogotá?"
   RESPUESTA ESPERADA: 4.14 por mil sobre ingresos gravables

5. "¿Cuál es el valor de la UVT para 2024?"
   RESPUESTA ESPERADA: $47,065
```

### **TEST-INV-004: Cálculos Esperados**

**Factura Servicios $1,000,000:**
- IVA: $190,000 (19%)
- Retención: $110,000 (11% servicios)
- Total: $1,080,000

**Factura Productos $500,000:**
- IVA: $95,000 (19%)  
- Retención: $12,500 (2.5% bienes)
- Total: $582,500

**Factura Arrendamiento $2,000,000:**
- IVA: $380,000 (19%)
- Retención: $70,000 (3.5% arriendo)
- Total: $2,310,000

---

## 📊 **FORMATO DE DOCUMENTACIÓN DE RESULTADOS**

### **Por cada test completado, usar este template:**

```markdown
## TEST-XXX-###: [Nombre del Test]

**Fecha:** [DD/MM/YYYY HH:MM]
**Ejecutor:** [Nombre]
**Navegador:** [Chrome/Firefox/Safari] [Versión]
**Dispositivo:** [Desktop/Mobile/Tablet]

### RESULTADO: ✅ PASS | ❌ FAIL | ⚠️ PARCIAL

### CRITERIOS EVALUADOS:
- [ ] Criterio 1: [Descripción]
- [ ] Criterio 2: [Descripción]  
- [ ] Criterio 3: [Descripción]

### TIEMPO EJECUCIÓN: [X minutos]

### ERRORES ENCONTRADOS:
1. **[CRÍTICO/ALTO/MEDIO/BAJO]** - [Descripción]
   - **Pasos reproducir:** [1, 2, 3...]
   - **Error message:** [Si aplica]
   - **Screenshot:** [Adjuntar si aplica]

### OBSERVACIONES:
- [Notas adicionales]
- [Comportamientos inesperados]
- [Sugerencias de mejora]

---
```

## 🎯 **CRITERIOS DE DECISIÓN**

### **🟢 APROBADO - Continuar a Producción**
- ✅ 90%+ tests críticos PASS
- ✅ Flujos E2E funcionan completamente  
- ✅ AI CFO responde coherentemente
- ✅ Procesamiento XML exitoso
- ✅ Cálculos tributarios correctos

### **🟡 APROBADO CON RESERVAS - Mejoras Menores**
- ⚠️ 75-90% tests críticos PASS
- ⚠️ Errores menores de UX
- ⚠️ Performance aceptable pero mejorable
- ⚠️ Funcionalidad core opera correctamente

### **🔴 NO APROBADO - Requiere Fixes**
- ❌ <75% tests críticos PASS
- ❌ Errores que impiden funcionalidad core
- ❌ AI CFO no operacional
- ❌ Procesamiento XML falla consistentemente
- ❌ Cálculos tributarios incorrectos

---

## 🛠️ **HERRAMIENTAS DE TESTING**

### **Browser Developer Tools:**
- Console para ver errores JavaScript
- Network para verificar llamadas API
- Performance para medir tiempos de carga

### **Screenshots Requeridos:**
- Dashboard con métricas reales
- Chat AI CFO con respuestas
- Facturas procesadas exitosamente
- Cualquier error encontrado

### **Logs a Revisar:**
- Errores de consola
- Failed network requests  
- Performance warnings
- OpenAI API response times

---

## 📱 **TESTING RESPONSIVE**

### **Resoluciones Críticas:**
- **Mobile:** 375x667 (iPhone)
- **Mobile:** 360x640 (Android)  
- **Tablet:** 768x1024 (iPad)
- **Desktop:** 1920x1080

### **Funcionalidades a Validar en Móvil:**
- [ ] Navegación y menú hamburguesa
- [ ] Upload de archivos
- [ ] Chat AI CFO
- [ ] Dashboard scrolling
- [ ] Forms de creación empresa

---

## 🚨 **PROCEDIMIENTO DE EMERGENCIA**

### **Si encuentras error crítico:**
1. **PARAR testing inmediatamente**
2. **Documentar con screenshots**
3. **Reproducir error 2 veces** 
4. **Reportar inmediatamente**
5. **No continuar hasta resolución**

### **Errores Críticos Definidos:**
- Sistema no carga (500 errors)
- AI CFO completamente no funcional
- No puede procesar ningún XML
- Pérdida de datos entre empresas
- Cálculos tributarios completamente incorrectos

---

## 📈 **MÉTRICAS DE SUCCESS**

### **Performance Targets:**
- Carga inicial: < 3 segundos
- AI response: < 30 segundos
- XML processing: < 10 segundos
- Dashboard render: < 2 segundos

### **Accuracy Targets:**
- PUC classification: > 70% confianza
- Tax calculations: 100% precisión en casos básicos
- AI responses: Coherencia y contexto colombiano

### **UX Targets:**  
- Navegación intuitiva
- Error messages claros
- Responsive funcional
- Flujos E2E sin interrupciones

---

**¡Ejecutar con rigor y documentar meticulosamente para asegurar calidad empresarial!** 🎯

**Recuerda:** La calidad del testing determina la confiabilidad del sistema en producción.