import { CheckCircle, Users, Zap, Shield, Award, PenTool, MessageCircle, Clock, BookOpen, Briefcase } from "lucide-react";
import "./About.scss";

const About = () => {
  const features = [
    {
      icon: <Users size={24} />,
      title: "Vetted Writing Experts",
      description: "Connect with professional copywriters and ghostwriters across multiple industries"
    },
    {
      icon: <Zap size={24} />,
      title: "On-Demand Content",
      description: "Access high-quality blog posts, articles, and corporate copy exactly when you need it"
    },
    {
      icon: <Shield size={24} />,
      title: "Secure & Confidential",
      description: "Your intellectual property and transactions are protected with industry-leading security"
    },
    {
      icon: <Award size={24} />,
      title: "Premium Quality",
      description: "All content undergoes rigorous quality checks to meet professional standards"
    }
  ];

  const howItWorks = [
    {
      step: "1",
      title: "Choose Your Service",
      description: "Browse through our writing categories and select the specific service your project requires"
    },
    {
      step: "2",
      title: "Collaborate with Writers",
      description: "Review professional portfolios and start a direct conversation with your chosen creative"
    },
    {
      step: "3",
      title: "Receive & Publish",
      description: "Get polished, original content tailored to your voice, ready to engage your audience"
    }
  ];

  const stats = [
    { icon: <Users size={32} />, value: "20+", label: "Professional Writers" },
    { icon: <MessageCircle size={32} />, value: "24/7", label: "Project Support" },
    { icon: <Clock size={32} />, value: "Instant", label: "Direct Communication" }
  ];

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="hero-content">
          <h1 className="hero-title">About RemyInk!</h1>
          <p className="hero-subtitle">
            Your premium content partner, connecting brands and professionals
            with elite writing talent for blogs, ghostwriting, and corporate storytelling
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="mission-section">
        <div className="section-container">
          <div className="mission-content">
            <h2 className="section-title">Our Mission</h2>
            <p className="mission-text">
              RemyInk! is a professional writing and content agency designed to help businesses and individuals communicate more effectively through expert storytelling and structured content strategy. We connect clients with qualified writers who craft compelling narratives, simplify complex industry topics, and drive brand authority.
            </p>

            <p className="mission-text">
              Our focus is on authentic voice and original perspective — helping our clients build digital influence, strengthen their professional branding, and develop high-impact communication assets. Whether you are scaling a SaaS blog, publishing your first book, or refining your corporate identity, we provide personalized creative support.
            </p>

            <p className="mission-text">
              We are firmly committed to originality and intellectual property rights. RemyInk! ensures that all work delivered is 100% original and tailored to the client's brief. We strictly oppose plagiarism and use advanced tools to guarantee that every piece of content strengthens your reputation.
            </p>

            <p className="mission-text">
              Our platform is built to make professional writing services accessible, scalable, and secure, ensuring every founder and professional has the opportunity to tell their story with confidence and clarity.
            </p>

            <p className="mission-text">
              We also empower world-class writers to share their talent, manage their freelance business, and earn competitive income by contributing meaningfully to the global content economy. This creates a collaborative ecosystem where quality and creativity thrive.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="section-container">
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="stat-card">
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-container">
          <h2 className="section-title">Why Choose RemyInk!</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="section-container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-container">
            {howItWorks.map((step, index) => (
              <div key={index} className="step-card">
                <div className="step-number">{step.step}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
                {index < howItWorks.length - 1 && (
                  <div className="step-connector"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="values-section">
        <div className="section-container">
          <h2 className="section-title">Our Core Values</h2>
          <div className="values-list">
            <div className="value-item">
              <CheckCircle className="value-icon" size={20} />
              <div className="value-content">
                <h3 className="value-title">Originality First</h3>
                <p className="value-description">
                  We guarantee 100% original content crafted specifically for your unique requirements
                </p>
              </div>
            </div>
            <div className="value-item">
              <CheckCircle className="value-icon" size={20} />
              <div className="value-content">
                <h3 className="value-title">Strategic Clarity</h3>
                <p className="value-description">
                  Clear communication and data-driven content strategies that deliver results
                </p>
              </div>
            </div>
            <div className="value-item">
              <CheckCircle className="value-icon" size={20} />
              <div className="value-content">
                <h3 className="value-title">Absolute Confidentiality</h3>
                <p className="value-description">
                  Your project details and identity are protected under strict NDA standards
                </p>
              </div>
            </div>
            <div className="value-item">
              <CheckCircle className="value-icon" size={20} />
              <div className="value-content">
                <h3 className="value-title">Client Success</h3>
                <p className="value-description">
                  We are dedicated to helping you achieve your professional and brand goals
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Elevate Your Content?</h2>
            <p className="cta-description">
              Join dozens of brands and professionals already scaling with RemyInk!
            </p>
            <div className="cta-buttons">
              <a href="/categories" className="btn-primary">Explore Services</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;  