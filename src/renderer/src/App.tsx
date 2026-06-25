import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import PageLogin from "./pages/PageLogin";
import PageMenu from "./pages/PageMenu";
import PageOrder from "./pages/PageOrder";

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<PageLogin />} />
        <Route path="/menu" element={<PageMenu />} />
        <Route path="/order" element={<PageOrder />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
