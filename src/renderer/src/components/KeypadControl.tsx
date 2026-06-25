import React from "react";

interface KeypadControlProps {
  onKeyPress: (key: string) => void;
  onClear?: () => void;
  onBackspace?: () => void;
}

const KeypadControl: React.FC<KeypadControlProps> = ({
  onKeyPress,
  onClear,
  onBackspace,
}) => {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleKeyClick = (key: string) => {
    if (key === "C") {
      onClear && onClear();
    } else if (key === "⌫") {
      onBackspace && onBackspace();
    } else {
      onKeyPress(key);
    }
  };

  return (
    <div style={styles.grid}>
      {keys.map((key, index) => (
        <button
          key={index}
          style={{
            ...styles.button,
            backgroundColor:
              key === "C" ? "#ff4757" : key === "⌫" ? "#eccc68" : "#ffffff",
            color: key === "C" || key === "⌫" ? "#fff" : "#2f3542",
            fontWeight: "bold",
          }}
          onClick={() => handleKeyClick(key)}
        >
          {key}
        </button>
      ))}
    </div>
  );
};

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    width: "100%",
    maxWidth: "320px",
    margin: "0 auto",
  },
  button: {
    height: "60px",
    fontSize: "24px",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
  },
};

export default KeypadControl;
