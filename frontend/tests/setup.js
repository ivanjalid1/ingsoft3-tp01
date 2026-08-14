import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Después de cada test: se desmonta el DOM y se limpia localStorage, para que
// un token de un test no se filtre al siguiente.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
