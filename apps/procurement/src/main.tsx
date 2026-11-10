import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "@atlas/design-system";
import App from "./App";
import { LocaleProvider } from "@atlas/shared";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <Provider><App /></Provider>
      </LocaleProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
