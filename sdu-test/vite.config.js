import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // 把这里的 sdu-test 换成你真实的 GitHub 仓库名称！
  base: '/SDU-MBTI/',
  plugins: [
    vue(),
    tailwindcss(),
  ],
})