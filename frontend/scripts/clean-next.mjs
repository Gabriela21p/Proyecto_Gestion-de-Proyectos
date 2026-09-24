import { rmSync } from 'node:fs';
import { join } from 'node:path';

// Next puede dejar artefactos incompatibles cuando cambia la estructura de
// rutas. Limpiarlos antes de dev/build hace que el arranque sea reproducible.
rmSync(join(process.cwd(), '.next'), { recursive: true, force: true });
