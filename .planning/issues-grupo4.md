# Issues del Grupo 4 - Hotel Estoicos

## Contexto
Basado en la conversación de WhatsApp del 16/08/2026 y la definición de roles por parte de Caren Romero. El grupo está trabajando en mejorar el HotelOS AI con enfoque en reliability, maintainability, security y devops.

## Integrantes del Grupo

| # | Nombre | Rol | Responsabilidades |
|---|--------|-----|-------------------|
| 1 | **Caren Romero** | Product Owner | Coordinación, Jira, Maintainability |
| 2 | **Karen Ocampo** | Scrum Master | Métricas DevOps, flujo de trabajo |
| 3 | **Jessica Sanchez** | Developer | Reliability issues 1-30 |
| 4 | **Diego Fernando Duran** | Developer | Reliability issues 31-60 |
| 5 | **Samuel Diaz** | QA/Tester | Maintainability primeras 150 |
| 6 | **Javier Moreno** | Security | Problema de seguridad a 0 |
| 7 | **Alex Hernandez** | DevOps/Analista | Métricas DevOps, k6, SonarQube |

## Issues Asignados

### Issue #1: Configurar Proyecto Jira y Definir Épicas
- **Asignado a**: Caren Romero (Product Owner)
- **Prioridad**: Alta
- **Fecha límite**: Mañana
- **Descripción**: 
  Crear proyecto en Jira y definir las 6 épicas identificadas:
  - Épica 1: Organización Agile y definición de roles
  - Épica 2: Mejorar Security
  - Épica 3: Mejorar Reliability
  - Épica 4: Mejorar Maintainability
  - Épica 5: Aumentar Coverage
  - Épica 6: Control... (pendiente de definir)
  
  Tareas adicionales:
  - Crear tareas para cada epic (424 issues de maintainability, 61 issues de reliability)
  - Asignar responsables y hacer seguimiento
  - Analizar métricas de maintainability de la línea 301 hasta el final
  - Coordinar corrección problema de seguridad

### Issue #2: Establecer Métricas y Flujo de Trabajo Jira
- **Asignado a**: Karen Ocampo (Scrum Master)
- **Prioridad**: Alta
- **Fecha límite**: Mañana
- **Descripción**:
  - Desarrollar herramienta/métrica de DevOps utilizando GitLab o Jenkins
  - Esta corresponde a la primera métrica expuesta en la conversación
  - Configurar tablero de Jira con roles y árbol de actividades
  - Crear issues para seguimiento de métricas
  - Coordinar trabajo entre los 7 integrantes del grupo
  - Definir actividades para martes y miércoles (aún por implementar)

### Issue #4: Analizar Issues de Reliability (31-60) ⭐
- **Asignado a**: Diego Fernando Duran (Integrante 4)
- **Prioridad**: Alta
- **Fecha límite**: Mañana
- **Descripción**:
  - Analizar los problemas de Reliability **del 31 al 60**
  - Actualmente hay 61 issues de reliability
  - Entregar informe con hallazgos
  - Priorizar issues críticos en este rango
  - Corregir issues principales
  - Probar soluciones implementadas
  - **Objetivo**: Reducir el número total de issues de reliability

**Relación con Issue #3**: Diego cubre issues 31-60, mientras que Jessica cubre issues 1-30. Juntos deben reducir los 61 issues totales a números menores.

### Issue #3: Analizar Issues de Reliability (1-30)
- **Asignado a**: Jessica Sanchez (Integrante 3)
- **Prioridad**: Alta
- **Fecha límite**: Mañana
- **Descripción**:
  - Analizar los primeros 30 problemas de Reliability
  - Entregar informe con hallazgos
  - Priorizar issues críticos en este rango (1-30)
  - Corregir issues principales
  - Probar soluciones implementadas
  - **Objetivo**: Reducir el número total de issues de reliability

**Relación con Issue #4**: Jessica cubre issues 1-30, mientras que Diego cubre issues 31-60. Juntos deben reducir los 61 issues totales a números menores.

### Issue #5: Analizar Issues de Maintainability (primeras 150)
- **Asignado a**: Samuel Diaz (QA/Tester)
- **Prioridad**: Alta
- **Fecha límite**: Mañana
- **Descripción**:
  - Analizar las primeras 150 métricas/problemas de Maintainability
  - Entregar informe con hallazgos
  - Identificar code smells y áreas de mejora
  - Refactorizar código problemático
  - Probar mejoras implementadas
  - **Contexto**: Hay 424 issues de maintainability en total, y esta es la primera fase (primeras 150)

### Issue #6: Analizar y Corregir Problema de Seguridad
- **Asignado a**: Javier Moreno (Security)
- **Prioridad**: Alta
- **Fecha límite**: Mañana
- **Descripción**:
  - Analizar problema de seguridad identificado
  - **Objetivo**: Reducir issues de seguridad a 0
  - Documentar hallazgos y soluciones
  - Verificar que no haya vulnerabilidades críticas
  - Coordinar con el equipo de development

**Contexto**: Según la conversación, "se debe quitar el de seguridad para que quede en 0 disminuir los de fiabilidad ahora estan en 61 debe quedar menor"

### Issue #7: Implementar Métricas de DevOps y Observabilidad
- **Asignado a**: Alex Hernandez (DevOps/Analista)
- **Prioridad**: Media
- **Fecha límite**: Mañana
- **Descripción**:
  - Desarrollar herramienta/métrica de DevOps utilizando GitLab o Jenkins
  - Implementar métricas de rendimiento de software
  - Configurar observabilidad con k6
  - Medir rendimiento web y reducir estrés
  - Integrar SonarQube
  - Generar reportes de métricas

**Contexto**: Según la conversación, "el rendimiento de la métrica sexta de rendimiento de software el observabilidad el k6 es muy fácil de implementar"

## Prioridades Generales

| Prioridad | Persona | Área | Tareas Principales |
|---|---|---|---|
| **Alta** | Diego (4) | Reliability | Analizar issues 31-60 |
| **Alta** | Samuel (5) | Maintainability | Analizar 150 métricas |
| **Alta** | Javier (6) | Security | Reducir a 0 issues |
| **Alta** | Jessica (3) | Reliability | Analizar issues 1-30 |
| **Media** | Alex (7) | DevOps | Implementar métricas |
| **Media** | Caren (1) | Product | Configurar Jira y épicas |
| **Media** | Karen (2) | Scrum Master | Coordinar flujo trabajo |

## Próximos Pasos

1. Revisar issues asignados en Jira
2. Entender alcance y fecha límite (mañana)
3. Ejecutar tarea descrita
4. Entregar informe al finalizar
5. Comentar en chat avances y dudas

## Objetivo General

- Reducir los 61 issues de reliability a números menores
- Disminuir los 424 issues de maintainability
- Dejar la seguridad en 0 issues
- Implementar métricas de DevOps y observabilidad con k6

---

*Este documento fue creado basado en la conversación de WhatsApp del grupo Hotel Estoicos el 16/08/2026. Para dudas o aclaraciones, contactar al Product Owner (Caren Romero).*