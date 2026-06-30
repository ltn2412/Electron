export const showAlert = (
  message: string,
  title = "Error",
  type: "success" | "error" | "info" = "error",
) => {
  window.dispatchEvent(
    new CustomEvent("app-alert", {
      detail: { message, title, type },
    }),
  );
};
