# 🏖️ Playas de Cantabria
*Consulta el estado de las playas de Cantabria en tiempo real. Esta aplicación proporciona información detallada sobre el oleaje, viento, temperatura, mareas y estado de la bandera de la Cruz Roja.*

---

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](../../releases)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-informational)
![Node.js](https://img.shields.io/badge/Node.js-20.x-informational)
![Express](https://img.shields.io/badge/Express-4.x-informational)
![React](https://img.shields.io/badge/React-18-informational)
![Ionic](https://img.shields.io/badge/Ionic-React-informational)
![Capacitor](https://img.shields.io/badge/Capacitor-mobile-informational)


📖 Available languages: **Español** | [English](README.en.md)

## 🚀 Demo en Producción

Puedes probar la aplicación cliente que consume esta API aquí:

👉 **[https://playas-cantabria-front.web.app/](https://playas-cantabria-front.web.app/)**


## 🐚 Funcionalidades

* 🏝️ **Listado de playas:** Visualiza todas las playas de Cantabria.  
* 🌊 **Detalles de la playa:** Obtén información detallada de cada playa, incluyendo:  
  * 🌬️ Estado del mar (oleaje y viento).  
  * 🌡️ Temperatura del agua y del ambiente.  
  * 🚩 Estado de la bandera de la Cruz Roja.  
* 🔍 **Búsqueda y filtrado:** Encuentra fácilmente la playa que te interesa.  
* 📍 **Localización:** Explora playas en el mapa usando tu posición con OpenStreetMap.  

## ✨ Características Principales

*   **Datos Consolidados:** Agrega información de múltiples fuentes de datos para ofrecer una vista unificada y completa:
    *   **AEMET:** Datos meteorológicos y predicciones.
    *   **OpenWeatherMap:** Datos meteorológicos como fuente de respaldo.
    *   **Cruz Roja:** Estado de la bandera y servicios de socorrismo.
*   **API RESTful:** Endpoints claros y predecibles para obtener listados y detalles de playas.
*   **Capa de Caché:** Cache en memoria para reducir la latencia y el número de peticiones a servicios externos.
*   **Manejo de Errores Centralizado:** Middleware para una gestión de errores consistente.
*   **Diseño Escalable:** La arquitectura hexagonal permite añadir nuevas fuentes de datos o cambiar las existentes con un impacto mínimo en la lógica de negocio.
*   **Configuración Flexible:** Uso de variables de entorno para una fácil configuración en diferentes entornos (desarrollo, producción).

---

## 🏛️ Arquitectura del Backend

El backend sigue una **Arquitectura Hexagonal** (también conocida como **Puertos y Adaptadores**). Este patrón de diseño nos permite aislar la lógica de negocio principal de las dependencias externas, como la base de datos, los servicios de terceros o la interfaz de usuario.

### Capas de la Arquitectura

1.  **`Domain` (El Núcleo)**
    *   **Contenido:** Contiene la lógica de negocio más pura y las reglas del dominio. Aquí se definen las `Entidades` (ej. `Beach`, `Weather`) y los `Puertos` (interfaces) que describen las funcionalidades que el dominio necesita del exterior (ej. `IBeachRepository`, `IWeatherProvider`).
    *   **Regla Clave:** No depende de ninguna otra capa. Es el corazón de la aplicación.

2.  **`Application` (Orquestación)**
    *   **Contenido:** Orquesta el flujo de datos y utiliza los casos de uso del dominio para realizar tareas específicas. Contiene los `Servicios de Aplicación` que son llamados por los adaptadores de entrada (como los controladores de la API).
    *   **Regla Clave:** Depende del `Domain`, pero no de la `Infrastructure`.

3.  **`Infrastructure` (El Exterior)**
    *   **Contenido:** Es la capa más externa y contiene la implementación de los `Puertos` definidos en el dominio. Aquí se encuentran los `Adaptadores` que interactúan con el mundo exterior.
    *   **Ejemplos de Adaptadores:**
        *   **API de Express:** El punto de entrada a nuestra aplicación.
        *   **Repositorios:** Implementación de la persistencia de datos (en este caso, a partir de archivos JSON).
        *   **Proveedores de Terceros:** Clientes HTTP para AEMET, OpenWeatherMap y Cruz Roja.
        *   **Inyección de Dependencias:** El contenedor que une todas las piezas.

---

## 🛠️ Pila Tecnológica

### Backend

*   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) v5.5
*   **Entorno de Ejecución:** [Node.js](https://nodejs.org/) v20+
*   **Framework Principal:** [Express.js](https://expressjs.com/) v4.19
*   **Arquitectura:** Hexagonal (Puertos y Adaptadores) con Inyección de Dependencias.
*   **Validación de Datos:** [Zod](https://zod.dev/) para validación de esquemas.
*   **Peticiones HTTP:** [Axios](https://axios-http.com/) v1.7
*   **Web Scraping:** [Cheerio](https://cheerio.js.org/) v1.0
*   **Gestión de Entorno:** [Dotenv](https://github.com/motdotla/dotenv)
*   **Logging:** [Winston](https://github.com/winstonjs/winston)
*   **Despliegue:** Adaptado para [Firebase Functions](https://firebase.google.com/docs/functions)

### Frontend

*   **Framework:** [React](https://reactjs.org/)
*   **UI Framework:** [Ionic](https://ionicframework.com/)
*   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
*   **Enrutador:** [React Router](https://reactrouter.com/)
*   **Plataforma Móvil:** [Capacitor](https://capacitorjs.com/)

---

## 📁 Estructura del Proyecto (Backend)

El directorio `backend/src` está organizado siguiendo los principios de la Arquitectura Hexagonal.

```
backend/src/
├── application/    # Orquestación y servicios de aplicación
│   ├── dtos/
│   ├── mappers/
│   └── services/
├── domain/         # Núcleo del negocio
│   ├── entities/
│   ├── ports/      # Interfaces para adaptadores externos
│   └── use-cases/
├── infrastructure/ # Implementación de los puertos y adaptadores
│   ├── cache/
│   ├── config/
│   ├── di/
│   ├── express/    # Servidor web, rutas y middlewares
│   ├── firebase/
│   ├── providers/  # Clientes para APIs externas (AEMET, etc.)
│   └── repositories/
└── index.ts        # Punto de entrada de la aplicación
```

*   **`domain`**: Contiene la lógica de negocio pura, sin dependencias externas.
*   **`application`**: Actúa como un puente entre el `domain` y la `infrastructure`.
*   **`infrastructure`**: Contiene todo el código que interactúa con sistemas externos: API, bases de datos, servicios de terceros, etc.

---

## 🚀 Cómo Empezar

Sigue estos pasos para configurar y ejecutar el proyecto en tu entorno local.

### Prerrequisitos

*   **Node.js:** Se requiere la versión `20` o superior. Puedes usar un gestor de versiones como [nvm](https://github.com/nvm-sh/nvm) para facilitar la gestión.
*   **Gestor de Paquetes:** [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/) o [pnpm](https://pnpm.io/).

### Instalación y Configuración

1.  **Clona el Repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/playas-cantabria.git
    cd playas-cantabria
    ```

2.  **Configura el Backend:**
    ```bash
    # Navega al directorio del backend
    cd backend

    # Instala las dependencias
    npm install

    # Crea tu archivo de entorno a partir del ejemplo
    cp .env.tmp .env
    ```
    Abre el archivo `.env` y rellena las variables con tus propias claves de API.

3.  **Configura el Frontend:**
    ```bash
    # Vuelve al directorio raíz y entra en el frontend
    cd ../frontend

    # Instala las dependencias
    npm install
    ```

---

## 🏃 Ejecución de la Aplicación

Debes tener dos terminales abiertas, una para el backend y otra para el frontend.

1.  **Inicia el Servidor Backend:**
    ```bash
    # Desde la carpeta /backend
    npm run dev
    ```
    ✅ El servidor se ejecutará en `http://localhost:4000`.

2. **Inicia la Aplicación Frontend:**
   ```bash
   # Desde la carpeta /frontend
   npm start
   ```
   ✅ La aplicación cliente estará disponible en `http://localhost:8100`.

---

## 🔌 API – Ejemplos

### 📋 Listado de playas
```bash
curl -X GET "http://localhost:4000/api/beaches"   -H "Accept: application/json"
```

### 📍 Detalles de una playa (datos consolidados)
```bash
curl -X GET "http://localhost:4000/api/beaches/3908503/details"   -H "Accept: application/json"
```

### ℹ️ Información básica de una playa
```bash
curl -X GET "http://localhost:4000/api/beaches/3908503"   -H "Accept: application/json"
```

👉 Reemplaza `3908503` con cualquier **ID válido de playa**.  
Las respuestas se devuelven en **JSON**.  
El endpoint `/details` consolida datos de **AEMET, OpenWeatherMap y Cruz Roja**.

---

## 🤝 Contribuciones


Las contribuciones son bienvenidas. Si tienes ideas, sugerencias o quieres reportar un error, por favor, abre un *issue* en este repositorio.

---

## 📜 Licencia
Este proyecto está bajo la licencia MIT No Commercial (MIT + NC).  
Consulta el archivo [LICENSE](./LICENSE) para más detalles.

## 📌 Versionado
Este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).  
Actualmente en **v1.0.0**.

## 🗺️ Roadmap

- [ ] Añadir más playas
- [ ] Incorporar datos de **mareas**
- [ ] Mejorar la arquitectura del **frontend** (estado, tipos discriminados, caching)
- [ ] Publicar **OpenAPI/Swagger** de la API
- [ ] Tests E2E básicos (Playwright) para flujos principales
