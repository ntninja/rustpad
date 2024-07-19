import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  Collapse,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  Select,
  Spacer,
  Stack,
  Switch,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import {
  VscChevronRight,
  VscFolderOpened,
  VscGist,
  VscRepoPull,
  VscMenu,
} from "react-icons/vsc";
import useStorage from "use-local-storage-state";
import Editor from "@monaco-editor/react";
import { editor } from "monaco-editor/esm/vs/editor/editor.api";
import rustpadRaw from "../rustpad-server/src/rustpad.rs?raw";
import languages from "./languages.json";
import animals from "./animals.json";
import Rustpad, { UserInfo } from "./rustpad";
import useHash from "./useHash";
import ConnectionStatus from "./ConnectionStatus";
import Footer from "./Footer";
import User from "./User";

function getWsUri(id: string) {
  let url = new URL(`api/socket/${id}`, window.location.href);
  url.protocol = (url.protocol == "https:") ? "wss:" : "ws:";
  return url.href;
}

function generateName() {
  return "Anonymous " + animals[Math.floor(Math.random() * animals.length)];
}

function generateHue() {
  return Math.floor(Math.random() * 360);
}

function getParam<T>(key: string, type: "string" | "number" | "boolean", def: T=null): T | null
{
  let searchString = window.location.hash.split("?")[1];
  let searchParams = new URLSearchParams(typeof(searchString) === "string" ? searchString : "");
  if (searchParams.has(key)) {
    let value = searchParams.get(key);
    if (type === "boolean") {
      value = value !== "false";
    } else if (type === "number") {
      value = Number(value);
    }
    return value;
  } else {
    return def;
  }
}

function useParamOrElse<T>(
  key: string, type: "string" | "number" | "boolean", makeState: () => [T, (T) => null]
): [T, (T) => null]
{
  let value = getParam(key, type);
  if (value !== null) {
    return useState(value);
  } else {
    return makeState();
  }
}

function useParamOrState<T>(
  key: string, type: "string" | "number" | "boolean", generator: () => T
): [T, (T) => null]
{
  return useParamOrElse(key, type, () => useState(generator));
}

function useParamOrStorage<T>(
  key: string, type: "string" | "number" | "boolean", generator: () => T
): [T, (T) => null]
{
  return useParamOrElse(key, type, () => useStorage(key, generator));
}

function App() {
  const id = useHash();  // Normalizes URL

  const sidebar = useDisclosure({
    defaultIsOpen: getParam("showSidebar", "boolean", true),
  });
  const [isSidebarHidden, setSidebarHidden] = useState(!sidebar.isOpen);
  const toast = useToast();
  const [language, setLanguage] = useParamOrState("language", "string", "plaintext");
  const [connection, setConnection] = useState<
    "connected" | "disconnected" | "desynchronized"
  >("disconnected");
  const [users, setUsers] = useState<Record<number, UserInfo>>({});
  const [name, setName] = useParamOrStorage("userName", "string", generateName);
  const [hue, setHue] = useParamOrStorage("userHue", "number", generateHue);
  const [editor, setEditor] = useState<editor.IStandaloneCodeEditor>();
  const [darkMode, setDarkMode] = useParamOrStorage(
    "darkMode", "boolean", () => window.matchMedia("(prefers-color-scheme: dark)")
  );
  const rustpad = useRef<Rustpad>();

  useEffect(() => {
    if (editor?.getModel()) {
      const model = editor.getModel()!;
      model.setValue("");
      model.setEOL(0); // LF
      rustpad.current = new Rustpad({
        uri: getWsUri(id),
        editor,
        onConnected: () => setConnection("connected"),
        onDisconnected: () => setConnection("disconnected"),
        onDesynchronized: () => {
          setConnection("desynchronized");
          toast({
            title: "Desynchronized with server",
            description: "Please save your work and refresh the page.",
            status: "error",
            duration: null,
          });
        },
        onChangeLanguage: (language) => {
          if (languages.includes(language)) {
            setLanguage(language);
          }
        },
        onChangeUsers: setUsers,
      });
      return () => {
        rustpad.current?.dispose();
        rustpad.current = undefined;
      };
    }
  }, [id, editor, toast, setUsers]);

  useEffect(() => {
    if (connection === "connected") {
      rustpad.current?.setInfo({ name, hue });
    }
  }, [connection, name, hue]);

  function handleChangeLanguage(language: string) {
    setLanguage(language);
    if (rustpad.current?.setLanguage(language)) {
      toast({
        title: "Language updated",
        description: (
          <>
            All users are now editing in{" "}
            <Text as="span" fontWeight="semibold">
              {language}
            </Text>
            .
          </>
        ),
        status: "info",
        duration: 2000,
        isClosable: true,
      });
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}/#${id}`);
    toast({
      title: "Copied!",
      description: "Link copied to clipboard",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  }

  function handleLoadSample() {
    if (editor?.getModel()) {
      const model = editor.getModel()!;
      model.pushEditOperations(
        editor.getSelections(),
        [
          {
            range: model.getFullModelRange(),
            text: rustpadRaw,
          },
        ],
        () => null
      );
      editor.setPosition({ column: 0, lineNumber: 0 });
      if (language !== "rust") {
        handleChangeLanguage("rust");
      }
    }
  }

  function handleDarkMode() {
    setDarkMode(!darkMode);
  }

  return (
    <Flex
      direction="column"
      h="100vh"
      overflow="hidden"
      bgColor={darkMode ? "#1e1e1e" : "white"}
      color={darkMode ? "#cbcaca" : "inherit"}
    >
      <Box
        flexShrink={0}
        bgColor={darkMode ? "#333333" : "#e8e8e8"}
        color={darkMode ? "#cccccc" : "#383838"}
        textAlign="center"
        fontSize="sm"
        py={0.5}
      >
        Rustpad
      </Box>
      <Flex flex="1 0" minH={0}>
        <Button
          {...sidebar.getButtonProps()}
          m={0.5}
          p={0.5}
          size="sm"
          bgColor="transparent"
          _hover={{
            bgColor: darkMode ? "rgba(87, 87, 89, 0.2)" : "rgba(128, 128, 128, 0.2)",
          }}
          _active={{
            bgColor: darkMode ? "rgba(87, 87, 89, 0.4)" : "rgba(128, 128, 128, 0.4)",
          }}
          position="absolute"
          zIndex={1}
        >
            <Icon
              as={VscMenu}
              color={darkMode ? "#cbcaca" : "inherit"}
            />
        </Button>
        <motion.div
          layout
          animate={{ "width": sidebar.isOpen ? "var(--chakra-sizes-xs)" : 0 }}
          transition={{ ease: "easeInOut" }}
          style={{
            overflow: "hidden",
            height: "100%",
          }}
        >
          <Container
            overflowY="auto"
            w="xs"
            h="100%"
            lineHeight={1.4}
            pl="2.5rem"
            bgColor={darkMode ? "#252526" : "#f3f3f3"}
          >
            <Flex justifyContent="space-between" mt={4} mb={1.5} w="full">
              <Heading size="sm">Dark Mode</Heading>
              <Switch isChecked={darkMode} onChange={handleDarkMode} />
            </Flex>

            <Heading mt={4} mb={1.5} size="sm">
              Language
            </Heading>
            <Select
              size="sm"
              bgColor={darkMode ? "#3c3c3c" : "white"}
              borderColor={darkMode ? "#3c3c3c" : "white"}
              value={language}
              onChange={(event) => handleChangeLanguage(event.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang} style={{ color: "black" }}>
                  {lang}
                </option>
              ))}
            </Select>

            <Heading mt={4} mb={1.5} size="sm">
              Share Link
            </Heading>
            <InputGroup size="sm">
              <Input
                readOnly
                pr="3.5rem"
                variant="outline"
                bgColor={darkMode ? "#3c3c3c" : "white"}
                borderColor={darkMode ? "#3c3c3c" : "white"}
                value={`${window.location.origin}/#${id}`}
              />
              <InputRightElement width="3.5rem">
                <Button
                  h="1.4rem"
                  size="xs"
                  onClick={handleCopy}
                  _hover={{ bg: darkMode ? "#575759" : "gray.200" }}
                  bgColor={darkMode ? "#575759" : "gray.200"}
                >
                  Copy
                </Button>
              </InputRightElement>
            </InputGroup>

            <Heading mt={4} mb={1.5} size="sm">
              Active Users
            </Heading>
            <Stack spacing={0} mb={1.5} fontSize="sm">
              <User
                info={{ name, hue }}
                isMe
                onChangeName={(name) => name.length > 0 && setName(name)}
                onChangeColor={() => setHue(generateHue())}
                darkMode={darkMode}
              />
              {Object.entries(users).map(([id, info]) => (
                <User key={id} info={info} darkMode={darkMode} />
              ))}
            </Stack>

            <Heading mt={4} mb={1.5} size="sm">
              About
            </Heading>
            <Text fontSize="sm" mb={1.5}>
              <strong>Rustpad</strong> is an open-source collaborative text editor
              based on the <em>operational transformation</em> algorithm.
            </Text>
            <Text fontSize="sm" mb={1.5}>
              Share a link to this pad with others, and they can edit from their
              browser while seeing your changes in real time.
            </Text>
            <Text fontSize="sm" mb={1.5}>
              Built using Rust and TypeScript. See the{" "}
              <Link
                color="blue.600"
                fontWeight="semibold"
                href="https://github.com/ekzhang/rustpad"
                isExternal
              >
                GitHub repository
              </Link>{" "}
              for details.
            </Text>

            <Button
              size="sm"
              colorScheme={darkMode ? "whiteAlpha" : "blackAlpha"}
              borderColor={darkMode ? "purple.400" : "purple.600"}
              color={darkMode ? "purple.400" : "purple.600"}
              variant="outline"
              leftIcon={<VscRepoPull />}
              mt={1}
              onClick={handleLoadSample}
            >
              Read the code
            </Button>
          </Container>
        </motion.div>
        <Flex flex={1} minW={0} h="100%" direction="column" overflow="hidden">
          <motion.div
            {...sidebar.getDisclosureProps()}
            layout
            hidden={false}
            animate={{ paddingLeft: sidebar.isOpen ? 0 : "var(--chakra-sizes-6)" }}
            transition={{ ease: "easeInOut" }}
          >
            <Flex direction="row">
              <HStack
                h={7}
                spacing={1}
                color="#888888"
                fontWeight="medium"
                fontSize="13px"
                px={3.5}
                flexShrink={0}
              >
                <Icon as={VscFolderOpened} fontSize="md" color="blue.500" />
                <Text>documents</Text>
                <Icon as={VscChevronRight} fontSize="md" />
                <Icon as={VscGist} fontSize="md" color="purple.500" />
                <Text>{id}</Text>
              </HStack>
              <Spacer/>
              <Box marginRight={2}>
                <ConnectionStatus darkMode={darkMode} connection={connection} />
              </Box>
            </Flex>
          </motion.div>
          <Box flex={1} minH={0}>
            <Editor
              theme={darkMode ? "vs-dark" : "vs"}
              language={language}
              options={{
                automaticLayout: true,
                fontSize: 13,
              }}
              onMount={(editor) => setEditor(editor)}
            />
          </Box>
        </Flex>
      </Flex>
      <Footer />
    </Flex>
 );
}

export default App;
