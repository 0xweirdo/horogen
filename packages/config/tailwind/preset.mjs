/**
 * Shared Tailwind preset — จะถูก wire เข้า apps/web ใน Phase 6 (Studio UI)
 * ตอนนี้มีแค่ brand token กลางไว้เป็นจุดเริ่ม
 */
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4f46e5',
          dark: '#3730a3',
        },
      },
    },
  },
};
