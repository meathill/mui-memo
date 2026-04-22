import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    schema: 'src/schema.ts',
    validators: 'src/validators.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
