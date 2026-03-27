import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import Game from "./Game";

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/game" element={<Game />} />
            </Routes>
        </Router>
    );
};

export default App;
