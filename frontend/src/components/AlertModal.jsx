import React from 'react';
import './AlertModal.css'; 

const AlertModal = ({ title, message, onClose }) => {
    return (
        <div className="alert-modal">
            <div className="modal-content">
                <h3>{title}</h3>
                <p>{message}</p>
                <button onClick={onClose}>확인</button>
            </div>
        </div>
    );
};

export default AlertModal;