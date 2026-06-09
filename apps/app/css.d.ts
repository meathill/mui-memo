// TypeScript 6.0 起，对「没有任何类型声明的副作用导入」（import './x.css'）会报 TS2882。
// NativeWind / react-native-css-interop 都只补 className 类型，并不声明 *.css 模块，
// 这里补一个全局声明，让 `import './global.css'` 这类样式副作用导入通过类型检查。
declare module '*.css';
