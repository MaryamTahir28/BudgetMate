import { useState } from "react";
import { View } from "react-native";
import { Dropdown } from "react-native-paper-dropdown";

const TestDrop = () => {
  const [showDropDown, setShowDropDown] = useState(false);
  const [value, setValue] = useState(null);

  const items = [
    { label: "Option 1", value: "1" },
    { label: "Option 2", value: "2" },
  ];

  return (
    <View style={{ padding: 20 }}>
      <Dropdown
        label="Select Option"
        mode="outlined"
        visible={showDropDown}
        showDropDown={() => setShowDropDown(true)}
        onDismiss={() => setShowDropDown(false)}
        value={value}
        setValue={setValue}
        list={items}
      />
    </View>
  );
};

export default TestDrop;
