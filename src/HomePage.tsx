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
                                Experience chess like never before. Play with your voice, powered by AI. No keyboard, no mouse—just your command.
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
                            <h2 className="section-title">Play Chess with Your Voice</h2>
                            <div className="description-text">
                                <p>
                                    Vocal Chess is a modern implementation of the classic game, designed for accessibility and hands-free play.
                                    Using advanced browser speech recognition, you can command your pieces simply by speaking their moves.
                                </p>
                            </div>
                            <div className="instruction-grid">
                                <div className="instruction-item">
                                    <span className="instruction-icon">🎙️</span>
                                    <div>
                                        <h4 className="instruction-title">Voice Control</h4>
                                        <p>Move pieces using standard notation like "e2 to e4" or "Knight f3".</p>
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
                    <p>Built with React, TypeScript, and Transformers.js</p>
                </footer>
            </div>
        </div>
    );
};

export default HomePage;
