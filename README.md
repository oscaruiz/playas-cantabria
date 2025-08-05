# 💢🏖️ playas-cantabria
¡Bienvenido/a a la aplicación de Playas de Cantabria!

## 🎯 Objetivo

El objetivo de esta aplicación es ofrecer una forma sencilla y rápida de consultar el estado de las playas de Cantabria en tiempo real. Podrás ver información sobre el oleaje, el viento, la temperatura y el estado de la bandera de la Cruz Roja.

## ✨ Características

*   **Listado de playas:** Visualiza todas las playas de Cantabria.
*   **Detalles de la playa:** Obtén información detallada de cada playa, incluyendo:
    *   Estado del mar (oleaje y viento).
    *   Temperatura del agua y del ambiente.
    *   Estado de la bandera de la Cruz Roja.
    *   Información sobre mareas.
*   **Búsqueda y filtrado:** Encuentra fácilmente la playa que te interesa.

## 🌐 Producción y Servicios

*   **Hosting y backend:** Usamos **Firebase Functions** para desplegar el backend sin servidor.
*   **Demo en producción:** Puedes probar la aplicación accediendo a  
    👉 [https://playas-cantabria-front.web.app/](https://playas-cantabria-front.web.app/)
*   **Fuentes de datos:**
    *   Principal: [AEMET](https://www.aemet.es/)
    *   Alternativa en caso de error: [OpenWeatherMap](https://openweathermap.org/)
    *   Cruz Roja: [CruzRoja](https://www.cruzroja.es/appjv/consPlayas/listaPlayas.do)

## 🛠️ Tecnologías Utilizadas

### Frontend

*   **Framework:** [React](https://reactjs.org/) v18.2.0
*   **UI Framework:** [Ionic](https://ionicframework.com/) v7.0.0
*   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) v4.1.3
*   **Enrutador:** [React Router](https://reactrouter.com/) v5.2.0
*   **Plataforma Móvil:** [Capacitor](https://capacitorjs.com/) v7.4.2

### Backend

*   **Framework:** [Express](https://expressjs.com/) v5.1.0
*   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) v5.8.3
*   **Peticiones HTTP:** [Axios](https://axios-http.com/) v1.10.0
*   **Web Scraping:** [Cheerio](https://cheerio.js.org/) v1.1.2

## 🚀 Cómo Empezar

### Prerrequisitos

*   [Node.js](https://nodejs.org/) (versión 14 o superior)
*   [npm](https://www.npmjs.com/)

### Instalación

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/playas-cantabria.git
    cd playas-cantabria
    ```

2.  **Instala las dependencias del frontend:**
    ```bash
    cd frontend
    npm install
    ```

3.  **Instala las dependencias del backend:**
    ```bash
    cd ../backend
    npm install
    ```


## 🔐 Variables de Entorno

Antes de ejecutar el proyecto, asegúrate de definir las variables necesarias en un archivo `.env` en el directorio `backend/`.

Ejemplo de `.env`:

```env
PORT=4000
AEMET_API_KEY=tu_clave_de_aemet
OPENWEATHER_API_KEY=tu_clave_de_openweather
CROSS_ORIGIN=http://localhost:8100
```

## 🚀 Ejecución

1.  **Inicia el backend:**
    ```bash
    cd backend
    npm run dev
    ```

2.  **Inicia el frontend:**
    ```bash
    cd frontend
    npm start
    ```

¡Y listo! La aplicación debería estar corriendo en tu navegador.

## 🤝 Contribuciones


Las contribuciones son bienvenidas. Si tienes alguna idea o quieres reportar un error, por favor, abre un *issue* en este repositorio.

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.
