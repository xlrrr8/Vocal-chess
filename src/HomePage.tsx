import React from "react";
import { Link } from "react-router-dom";
import knightHero from "./assets/hero_knight.png";
import abstractWaves from "./assets/abstract_waves.png";

const HomePage: React.FC = () => {
    return (
        <div className="home-page">
            <div className="home-container">
                {/* Hero Section */}
                <section className="hero-section">
                    <div className="hero-grid">
                        <div className="hero-content">
                            <div className="hero-badge">Next Gen Chess</div>
                            <h1 className="hero-title">
                                Vocal Chess
                            </h1>
                            <p className="hero-subtitle">
                                Experience chess like never before. A sleek, modern chess experience with AI opponent and game analysis.
                            </p>
                            <Link to="/game" className="cta-button">
                                <span>Start Playing</span>
                                <span className="arrow">→</span>
                            </Link>
                        </div>
                        <div className="hero-image-container">
                            <img
                                src={abstractWaves}
                                alt="Voice Abstract"
                                className="hero-image"
                            />
                            <div className="hero-image-glow"></div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="description-section">
                    <div className="description-grid">
                        <div className="description-visual">
                            <img
                                src={knightHero}
                                alt="Cyan Knight Hero"
                                className="side-visual"
                            />
                        </div>
                        <div className="description-content">
                            <h2 className="section-title">Play Chess Your Way</h2>
                            <div className="description-text">
                                <p>
                                    Vocal Chess is a modern implementation of the classic game, designed with a beautiful dark UI.
                                    Play against the built-in AI engine or face off with a friend on the same board.
                                </p>
                            </div>
                            <div className="instruction-grid">
                                <div className="instruction-item">
                                    <span className="instruction-icon">♟️</span>
                                    <div>
                                        <h4 className="instruction-title">Click to Move</h4>
                                        <p>Select a piece and click a destination square to make your move.</p>
                                    </div>
                                </div>
                                <div className="instruction-item">
                                    <span className="instruction-icon">🤖</span>
                                    <div>
                                        <h4 className="instruction-title">AI Engine</h4>
                                        <p>Standard minimax engine to challenge your tactical skills.</p>
                                    </div>
                                </div>
                                <div className="instruction-item">
                                    <span className="instruction-icon">📊</span>
                                    <div>
                                        <h4 className="instruction-title">In-depth Analysis</h4>
                                        <p>Review your games with accuracy ratings and blunder detection.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="home-footer">
                    <p>Built with React, TypeScript, and chess.js</p>
                </footer>
            </div>
        </div>
    );
};

export default HomePage;
