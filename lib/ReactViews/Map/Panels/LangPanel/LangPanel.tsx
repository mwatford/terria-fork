import React from "react";
import Box from "../../../../Styled/Box";
import { RawButton } from "../../../../Styled/Button";
import Ul, { Li } from "../../../../Styled/List";
import i18n from "i18next";

import MenuPanel from "../../../StandardUserInterface/customizable/MenuPanel";
import Terria from "../../../../Models/Terria";

import Styles from "../../menu-bar.scss";
import Icon from "../../../Icon";
import { useTranslation } from "react-i18next";

const stripLangLocale = (lang: string = ""): string => lang.split("-")[0];

type Props = {
  i18n: typeof i18n;
  terria: Terria;
  smallScreen: boolean;
};

export default (props: Props) => {
  const { t } = useTranslation();

  if (!props.terria.configParameters.languageConfiguration?.languages) {
    return null;
  }

  return (
    //@ts-ignore - not yet ready to tackle tsfying MenuPanel
    <MenuPanel
      theme={{
        btn: Styles.langBtn,
        icon: Icon.GLYPHS.globe
      }}
      btnText={
        props.smallScreen
          ? t("languagePanel.changeLanguage")
          : stripLangLocale(props.i18n.language)
      }
      smallScreen={props.smallScreen}
      forceClosed={true}
    >
      <Box static styledPadding={"20px 10px 10px 10px"}>
        <Ul spaced lined fullWidth>
          {Object.entries(
            props.terria.configParameters.languageConfiguration.languages
          ).map(([key, value]) => (
            <Li key={key}>
              <RawButton onClick={() => i18n.changeLanguage(key)}>
                {value}
              </RawButton>
            </Li>
          ))}
        </Ul>
      </Box>
    </MenuPanel>
  );
};
