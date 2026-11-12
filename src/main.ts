import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { App } from "./app";

import "./index.css";

bootstrapApplication(App, {
    providers: [provideZonelessChangeDetection()],
}).catch((err) => console.error(err));
