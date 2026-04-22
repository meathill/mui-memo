import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    schema: 'src/schema.ts',
    validators: 'src/validators.ts',
    logic: 'src/logic.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
