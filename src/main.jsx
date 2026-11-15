import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/barlow-semi-condensed/400.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/saira/300.css';
import '@fontsource/saira/400.css';
import '@fontsource/saira/600.css';
import '@fontsource/saira/700-italic.css';
import '@fontsource/saira/600-italic.css';
import './app.css';

createRoot(document.getElementById('root')).render(<App />);
