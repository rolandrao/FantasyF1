import React from 'react'
import '../styles/F1Car.css'

const F1TopDownCar = ({ color, code, delay }) => {
  // We define variables here to support dynamic CSS variables from props
  const containerStyle = {
    '--car-color': color,
    '--wheel-color': '#000000ff',
    '--suspension-color': '#555',
    animationDelay: `${delay}s`
  }

  return (
    <div className="car-scaler">
        <div className="f1-container" style={containerStyle}>
            <div className="f1-div f1-nose-top"></div>
            <div className="f1-div f1-nose-bottom"></div>
            <div className="f1-div f1-nose"></div>
            <div className="f1-div f1-front-wing"></div>
            <div className="f1-div f1-top-front-wing-trim"></div>
            <div className="f1-div f1-bottom-front-wing-trim"></div>
            <div className="f1-div f1-top-front-wing-trim-2"></div>
            <div className="f1-div f1-bottom-front-wing-trim-2"></div>
            <div className="f1-div f1-top-front-wing"></div>
            <div className="f1-div f1-top-front-wing-tail"></div>
            <div className="f1-div f1-bottom-front-wing"></div>
            <div className="f1-div f1-bottom-front-wing-tail"></div>
            <div className="f1-div f1-bottom-front-wheel"></div>
            <div className="f1-div f1-bottom-back-wheel"></div>
            <div className="f1-div f1-top-front-wheel"></div>
            <div className="f1-div f1-top-back-wheel"></div>
            <div className="f1-div f1-rear-body"></div>
            
            {/* WING WITH TEXT */}
            <div className="f1-div f1-rear-wing-bg">
                <span className="wing-text">{code}</span>
            </div>

            <div className="f1-div f1-top-body-curve"></div>
            <div className="f1-div f1-top-body-curve-cut"></div>
            <div className="f1-div f1-top-body-curve-straight"></div>
            <div className="f1-div f1-top-body-curve-straight-2"></div>
            <div className="f1-div f1-bottom-body-curve"></div>
            <div className="f1-div f1-bottom-body-curve-cut"></div>
            <div className="f1-div f1-bottom-body-curve-straight"></div>
            <div className="f1-div f1-bottom-body-curve-straight-2"></div>
            <div className="f1-div f1-back-body-curve"></div>
            <div className="f1-div f1-body-hood"></div>
            <div className="f1-div f1-back-body"></div>
            <div className="f1-div f1-back-body-top"></div>
            <div className="f1-div f1-back-body-bottom"></div>
            <div className="f1-div f1-back-body-2"></div>
            <div className="f1-div f1-top-spoke-1"></div>
            <div className="f1-div f1-top-spoke-2"></div>
            <div className="f1-div f1-top-spoke-3"></div>
            <div className="f1-div f1-top-spoke-4"></div>
            <div className="f1-div f1-bottom-spoke-1"></div>
            <div className="f1-div f1-bottom-spoke-2"></div>
            <div className="f1-div f1-bottom-spoke-3"></div>
            <div className="f1-div f1-bottom-spoke-4"></div>
            <div className="f1-div f1-back-spoke"></div>
            <div className="f1-div f1-mirror-top"></div>
            <div className="f1-div f1-mirror-bottom"></div>
            <div className="f1-div f1-driver-bg"></div>
            <div className="f1-div f1-driver-wheel"></div>
            <div className="f1-div f1-driver-helmet"></div>
            <div className="f1-div f1-bottom-body-spine"></div>
            <div className="f1-div f1-top-body-spine"></div>
            <div className="f1-div f1-end-body-spine"></div>
            <div className="f1-div f1-top-body-spine-2"></div>
            <div className="f1-div f1-bottom-body-spine-2"></div>
        </div>
    </div>
  )
}

export default F1TopDownCar