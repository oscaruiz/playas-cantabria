# Firebase Deployment Guide

This guide will help you deploy the frontend and backend to Firebase and configure the environment variables correctly.

## Backend Deployment

When you deploy the backend to Firebase Functions, you need to set the `BASE_URL` environment variable. This will be the URL of your Firebase Function.

1.  **Deploy your function:** Follow the Firebase documentation to deploy your Express app as a Firebase Function.
2.  **Set environment variables:** You can set environment variables in the `firebase.json` file or by using the Firebase CLI.

    **Using the Firebase CLI:**

    ```bash
    firebase functions:config:set api.base_url="<your_firebase_function_url>"
    ```

    Replace `<your_firebase_function_url>` with the actual URL of your deployed function.

    **Using `firebase.json`:**

    You can also define the environment variables in your `firebase.json` file.

    ```json
    {
      "functions": {
        "source": "backend",
        "runtime": "nodejs16",
        "environment": {
          "BASE_URL": "<your_firebase_function_url>"
        }
      }
    }
    ```

## Frontend Deployment

When you deploy the frontend to Firebase Hosting, you need to set the `REACT_APP_BASE_API_URL` environment variable to the URL of your deployed backend.

1.  **Build the frontend:**

    ```bash
    cd frontend
    REACT_APP_BASE_API_URL=<your_firebase_function_url> npm run build
    ```

    Replace `<your_firebase_function_url>` with the URL of your deployed Firebase Function.

2.  **Deploy to Firebase Hosting:**

    Follow the Firebase documentation to deploy the contents of the `frontend/build` directory to Firebase Hosting.

By following these steps, your frontend will make API calls to the deployed backend on Firebase Functions.
